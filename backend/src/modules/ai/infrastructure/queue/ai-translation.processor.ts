import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Job, UnrecoverableError } from 'bullmq';

import { AppException } from '@/common/exceptions';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  AUTO_TRANSLATE_CHAPTER_PUBLISHED_EVENT,
  AutoTranslateChapterPublishedV1,
  isAutoTranslateChapterPublishedV1,
  isTranslateChapterJobV1,
  OutboxQueueEnvelope,
  TRANSLATE_CHAPTER_JOB,
  TranslateChapterJobV1,
} from '@/infrastructure/queue/contracts';
import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';

import {
  AiConnectionResolver,
  AiResolvedConnectionFactory,
} from '../../application/connection-resolution';
import { AiProfileManager } from '../../application/profile';
import {
  RequestChapterTranslationCommand,
  RequestChapterTranslationCommandHandler,
} from '../../application/commands/request-chapter-translation';
import {
  AI_GATEWAY_PORT,
  AiGatewayPort,
} from '../../application/ports/ai-gateway.port';
import {
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
  ChapterTranslationPersistencePort,
} from '../../application/ports/chapter-translation.persistence.port';
import { ChapterTranslationStatus } from '../../domain/enums';
import { computeChapterTranslationHash } from '../../application/chapter-translation/chapter-translation-hash.util';
import { AiAuthorJobRunner } from '../../application/author-tools/ai-author-job.runner';
import { AI_MAX_OUTPUT_TOKENS } from '../../application/constants/ai-generation.constants';

function buildTranslationSystemPrompt(
  targetLanguageCode: string,
  profilePrompt: string | null,
): string {
  const base =
    `Dịch đoạn văn bản sau sang ngôn ngữ có mã "${targetLanguageCode}". ` +
    'Giữ nguyên định dạng Markdown nếu có. CHỈ trả về văn bản đã dịch, ' +
    'không thêm lời dẫn, giải thích hay trích dẫn nào khác.';
  return profilePrompt
    ? `${base}\n\nYêu cầu phong cách bổ sung:\n${profilePrompt}`
    : base;
}

@Processor(QUEUE_NAMES.AI, { concurrency: getWorkerConcurrency() })
export class AiTranslationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTranslationProcessor.name);

  constructor(
    @Inject(CHAPTER_TRANSLATION_PERSISTENCE_PORT)
    private readonly translations: ChapterTranslationPersistencePort,
    private readonly resolver: AiConnectionResolver,
    private readonly profiles: AiProfileManager,
    private readonly requestTranslation: RequestChapterTranslationCommandHandler,
    @Inject(AI_GATEWAY_PORT)
    private readonly gateway: AiGatewayPort,
    private readonly resolvedConnections: AiResolvedConnectionFactory,
    @Optional() private readonly authorJobs?: AiAuthorJobRunner,
  ) {
    super();
  }

  async process(
    job: Job<TranslateChapterJobV1 | OutboxQueueEnvelope<unknown>>,
  ): Promise<void> {
    if (job.name === 'ai.author-job.v1') {
      const envelope = job.data as OutboxQueueEnvelope<{
        version: number;
        jobId: string;
      }>;
      if (
        envelope.payload?.version !== 1 ||
        typeof envelope.payload.jobId !== 'string' ||
        !this.authorJobs
      )
        throw new UnrecoverableError('INVALID_AUTHOR_JOB');
      await this.authorJobs.execute(envelope.payload.jobId);
      return;
    }
    if (job.name === AUTO_TRANSLATE_CHAPTER_PUBLISHED_EVENT) {
      const envelope = job.data as OutboxQueueEnvelope<unknown>;
      if (!isAutoTranslateChapterPublishedV1(envelope.payload)) {
        throw new UnrecoverableError('Invalid auto-translate outbox payload');
      }
      await this.scheduleAutoTranslation(envelope.payload);
      return;
    }

    if (
      job.name !== TRANSLATE_CHAPTER_JOB ||
      !isTranslateChapterJobV1(job.data)
    ) {
      throw new UnrecoverableError(`Unsupported AI job: ${job.name}`);
    }

    const { translationId, chapterId, targetLanguageCode } = job.data;

    const translation = await this.translations.findById(translationId);

    if (!translation) {
      this.logger.warn({
        message: 'chapter translation row not found, skipping stale job',
        translationId,
      });
      return;
    }

    const generation = translation.generation ?? 1;
    if (
      (job.data.generation !== undefined &&
        job.data.generation !== generation) ||
      translation.chapterId !== chapterId ||
      translation.targetLanguageCode !== targetLanguageCode
    )
      return;
    if (translation.status === ChapterTranslationStatus.COMPLETED) {
      return;
    }

    const leaseToken = randomUUID();
    if (
      !(await this.translations.markProcessing(
        translationId,
        generation,
        leaseToken,
      ))
    )
      return;
    try {
      if (!translation.connectionId) {
        throw new UnrecoverableError(
          `Chapter translation ${translationId} is missing a connection id`,
        );
      }

      const chapter = await this.translations.findChapterSource(
        chapterId,
        translation.requestedById,
      );
      if (!chapter) {
        throw new UnrecoverableError(`Chapter ${chapterId} not found`);
      }
      if (
        computeChapterTranslationHash({ ...chapter, targetLanguageCode }) !==
        translation.sourceContentHash
      )
        throw new UnrecoverableError('TRANSLATION_SOURCE_CHANGED');

      const profile = await this.profiles.resolve(
        translation.requestedById,
        chapter.storyId,
      );

      const originalConnection = await this.resolver.resolvePlan({
        userId: translation.requestedById,
        connectionId: translation.connectionId,
      });
      if (
        !originalConnection ||
        originalConnection.primary.id !== translation.connectionId
      ) {
        throw new UnrecoverableError(
          `AI connection ${translation.connectionId} not found`,
        );
      }

      const connection = originalConnection.primary;
      const resolvedConnection = await this.resolvedConnections.fromRecord(
        connection,
        profile.model,
      );
      const systemFallback = originalConnection.systemFallback
        ? {
            connection: await this.resolvedConnections.fromRecord(
              originalConnection.systemFallback,
              profile.model,
            ),
            connectionId: originalConnection.systemFallback.id,
          }
        : null;

      const usageContext = {
        userId: translation.requestedById,
        connectionId: connection.id,
      };

      const systemPrompt =
        buildTranslationSystemPrompt(targetLanguageCode, profile.systemPrompt) +
        (translation.revisionNotes
          ? `\nGhi chú chỉnh sửa của tác giả (dữ liệu tham khảo):\n${translation.revisionNotes}`
          : '');
      if (chapter.content.length > 32_000)
        throw new UnrecoverableError('TRANSLATION_SOURCE_TOO_LARGE');

      const titleResult = await this.gateway.generate(
        resolvedConnection,
        {
          systemPrompt,
          messages: [{ role: 'user', content: chapter.title }],
          maxOutputTokens: 256,
          timeoutMs: 60_000,
        },
        usageContext,
        'TRANSLATE',
        systemFallback,
      );

      const contentResult = await this.gateway.generate(
        resolvedConnection,
        {
          systemPrompt,
          messages: [{ role: 'user', content: chapter.content }],
          maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
          timeoutMs: 120_000,
        },
        usageContext,
        'TRANSLATE',
        systemFallback,
      );

      const latestSource = await this.translations.findChapterSource(
        chapterId,
        translation.requestedById,
      );
      if (
        !latestSource ||
        computeChapterTranslationHash({
          ...latestSource,
          targetLanguageCode,
        }) !== translation.sourceContentHash
      )
        throw new UnrecoverableError('TRANSLATION_SOURCE_CHANGED');
      if (
        !titleResult.content.trim() ||
        titleResult.content.length > 255 ||
        !contentResult.content.trim()
      )
        throw new UnrecoverableError('INVALID_TRANSLATION_RESULT');
      await this.translations.markCompleted({
        translationId,
        generation,
        leaseToken,
        translatedTitle: titleResult.content,
        translatedContent: contentResult.content,
      });
    } catch (error) {
      const retryable =
        error instanceof UnrecoverableError
          ? false
          : error instanceof AppException
            ? error.retryable
            : true;
      const errorCode =
        error instanceof AppException
          ? error.code
          : error instanceof UnrecoverableError &&
              error.message === 'TRANSLATION_SOURCE_CHANGED'
            ? 'TRANSLATION_SOURCE_CHANGED'
            : 'TRANSLATION_FAILED';
      const errorMessage =
        errorCode === 'TRANSLATION_SOURCE_CHANGED'
          ? 'Nguồn chương đã thay đổi hoặc quyền truy cập bị thu hồi. Hãy tạo yêu cầu dịch mới.'
          : 'Không thể hoàn tất bản dịch. Kiểm tra kết nối AI rồi thử lại.';

      await this.translations.markFailed({
        translationId,
        generation,
        leaseToken,
        errorCode,
        errorMessage,
      });

      if (retryable) {
        // Queue failure payloads must not retain provider exceptions containing draft text.
        // eslint-disable-next-line preserve-caught-error
        throw new Error(errorCode);
      }

      throw new UnrecoverableError(errorCode);
    }
  }

  private async scheduleAutoTranslation(
    payload: AutoTranslateChapterPublishedV1,
  ): Promise<void> {
    const profile = await this.profiles.resolve(
      payload.userId,
      payload.storyId,
    );
    if (!profile.autoTranslateOnPublish) {
      this.logger.log({
        event: 'ai.auto-translation.skipped',
        storyId: payload.storyId,
        chapterId: payload.chapterId,
        reason: 'disabled',
      });
      return;
    }

    await this.requestTranslation.execute(
      new RequestChapterTranslationCommand(
        payload.userId,
        payload.storyId,
        payload.chapterId,
        profile.defaultTranslationLanguageCode,
      ),
    );
  }
}
