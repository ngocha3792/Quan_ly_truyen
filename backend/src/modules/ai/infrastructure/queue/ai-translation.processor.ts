import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
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
  ) {
    super();
  }

  async process(
    job: Job<TranslateChapterJobV1 | OutboxQueueEnvelope<unknown>>,
  ): Promise<void> {
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

    if (translation.status === ChapterTranslationStatus.COMPLETED) {
      return;
    }

    if (!translation.connectionId) {
      throw new UnrecoverableError(
        `Chapter translation ${translationId} is missing a connection id`,
      );
    }

    const chapter = await this.translations.findChapterSource(chapterId);
    if (!chapter) {
      throw new UnrecoverableError(`Chapter ${chapterId} not found`);
    }

    const profile = await this.profiles.resolve(
      translation.requestedById,
      chapter.storyId,
    );

    const originalConnection = await this.resolver.resolvePlan({
      userId: translation.requestedById,
      connectionId: translation.connectionId,
    });
    if (!originalConnection) {
      throw new UnrecoverableError(
        `AI connection ${translation.connectionId} not found`,
      );
    }

    await this.translations.markProcessing(translationId);

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

    const systemPrompt = buildTranslationSystemPrompt(
      targetLanguageCode,
      profile.systemPrompt,
    );

    try {
      const titleResult = await this.gateway.generate(
        resolvedConnection,
        { systemPrompt, messages: [{ role: 'user', content: chapter.title }] },
        usageContext,
        'TRANSLATE',
        systemFallback,
      );

      const contentResult = await this.gateway.generate(
        resolvedConnection,
        {
          systemPrompt,
          messages: [{ role: 'user', content: chapter.content }],
        },
        usageContext,
        'TRANSLATE',
        systemFallback,
      );

      await this.translations.markCompleted({
        translationId,
        translatedTitle: titleResult.content,
        translatedContent: contentResult.content,
      });
    } catch (error) {
      const retryable = error instanceof AppException ? error.retryable : true;
      const errorCode = error instanceof AppException ? error.code : 'UNKNOWN';
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Lỗi không xác định khi dịch chương';

      await this.translations.markFailed({
        translationId,
        errorCode,
        errorMessage,
      });

      if (retryable) {
        throw error;
      }

      throw new UnrecoverableError(errorMessage);
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
