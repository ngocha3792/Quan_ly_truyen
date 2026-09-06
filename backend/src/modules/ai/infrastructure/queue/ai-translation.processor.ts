import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';

import { AppException } from '@/common/exceptions';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  isTranslateChapterJobV1,
  TRANSLATE_CHAPTER_JOB,
  TranslateChapterJobV1,
} from '@/infrastructure/queue/contracts';
import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../application/ports/ai-connection.persistence.port';
import {
  AI_CREDENTIAL_VAULT_PORT,
  AiCredentialVaultPort,
} from '../../application/ports/ai-credential-vault.port';
import {
  AI_GATEWAY_PORT,
  AiGatewayPort,
} from '../../application/ports/ai-gateway.port';
import { AiConnectionConfig } from '../../application/ports/ai-provider-client.port';
import {
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
  ChapterTranslationPersistencePort,
} from '../../application/ports/chapter-translation.persistence.port';
import { AiProviderRegistry } from '../providers/ai-provider.registry';

function buildTranslationSystemPrompt(targetLanguageCode: string): string {
  return (
    `Dịch đoạn văn bản sau sang ngôn ngữ có mã "${targetLanguageCode}". ` +
    'Giữ nguyên định dạng Markdown nếu có. CHỈ trả về văn bản đã dịch, ' +
    'không thêm lời dẫn, giải thích hay trích dẫn nào khác.'
  );
}

@Processor(QUEUE_NAMES.AI, { concurrency: getWorkerConcurrency() })
export class AiTranslationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTranslationProcessor.name);

  constructor(
    @Inject(CHAPTER_TRANSLATION_PERSISTENCE_PORT)
    private readonly translations: ChapterTranslationPersistencePort,
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly connections: AiConnectionPersistencePort,
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    @Inject(AI_GATEWAY_PORT)
    private readonly gateway: AiGatewayPort,
    private readonly registry: AiProviderRegistry,
  ) {
    super();
  }

  async process(job: Job<TranslateChapterJobV1>): Promise<void> {
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

    if (translation.status === 'COMPLETED') {
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

    const connection = await this.connections.findById(
      translation.connectionId,
    );
    if (!connection) {
      throw new UnrecoverableError(
        `AI connection ${translation.connectionId} not found`,
      );
    }

    await this.translations.markProcessing(translationId);

    const config: AiConnectionConfig = {
      provider: connection.provider,
      apiKey: await this.vault.decrypt(connection.encryptedApiKey),
      baseUrl: connection.baseUrl,
      model:
        connection.defaultModel ?? this.registry.getModel(connection.provider),
    };

    const usageContext = {
      userId: translation.requestedById,
      connectionId: connection.id,
    };

    const systemPrompt = buildTranslationSystemPrompt(targetLanguageCode);

    try {
      const titleResult = await this.gateway.generate(
        config,
        { systemPrompt, messages: [{ role: 'user', content: chapter.title }] },
        usageContext,
        'TRANSLATE',
      );

      const contentResult = await this.gateway.generate(
        config,
        {
          systemPrompt,
          messages: [{ role: 'user', content: chapter.content }],
        },
        usageContext,
        'TRANSLATE',
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
}
