import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  BusinessRuleViolationException,
  ExternalServiceException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  TRANSLATE_CHAPTER_JOB,
  TranslateChapterJobV1,
} from '@/infrastructure/queue/contracts';
import {
  CHAPTER_PERSISTENCE_PORT,
  ChapterPersistencePort,
} from '@/modules/chapters';

import {
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
  ChapterTranslationPersistencePort,
} from '../../ports/chapter-translation.persistence.port';
import { AiConnectionResolverService } from '../../services/ai-connection-resolver.service';
import { computeChapterTranslationHash } from '../../services/chapter-translation-hash.util';
import { RequestChapterTranslationCommand } from './request-chapter-translation.command';
import { RequestChapterTranslationResultView } from './request-chapter-translation.view';

@Injectable()
export class RequestChapterTranslationCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly chapters: ChapterPersistencePort,
    @Inject(CHAPTER_TRANSLATION_PERSISTENCE_PORT)
    private readonly translations: ChapterTranslationPersistencePort,
    private readonly resolver: AiConnectionResolverService,
    @Optional()
    @InjectQueue(QUEUE_NAMES.AI)
    private readonly queue?: Queue,
  ) {}

  async execute(
    command: RequestChapterTranslationCommand,
  ): Promise<RequestChapterTranslationResultView> {
    const chapter = await this.chapters.findOwnedById(
      command.userId,
      command.storyId,
      command.chapterId,
    );

    if (!chapter) {
      throw new ResourceNotFoundException({
        resource: 'chương',
        identifier: command.chapterId,
      });
    }

    const connection = await this.resolver.resolve({
      userId: command.userId,
      connectionId: command.connectionId,
    });

    if (!connection) {
      throw new BusinessRuleViolationException({
        message:
          'Chưa có kết nối AI để dịch. Vui lòng thêm kết nối trong phần cài đặt.',
        rule: 'ai-connection.required',
      });
    }

    const sourceContentHash = computeChapterTranslationHash({
      title: chapter.title,
      content: chapter.content,
      targetLanguageCode: command.targetLanguageCode,
    });

    const existing = await this.translations.findByChapterAndLanguage(
      command.chapterId,
      command.targetLanguageCode,
    );

    if (
      existing &&
      existing.status === 'COMPLETED' &&
      existing.sourceContentHash === sourceContentHash
    ) {
      return {
        id: existing.id,
        status: existing.status,
        targetLanguageCode: existing.targetLanguageCode,
      };
    }

    const translation = await this.translations.upsertPending({
      chapterId: command.chapterId,
      targetLanguageCode: command.targetLanguageCode,
      requestedById: command.userId,
      connectionId: connection.id,
      sourceContentHash,
    });

    if (!this.queue) {
      throw new ExternalServiceException({
        service: 'Hàng đợi dịch AI',
        message: 'Dịch vụ hàng đợi hiện không khả dụng. Vui lòng thử lại sau.',
      });
    }

    const payload: TranslateChapterJobV1 = {
      version: 1,
      translationId: translation.id,
      chapterId: command.chapterId,
      targetLanguageCode: command.targetLanguageCode,
    };

    await this.queue.add(TRANSLATE_CHAPTER_JOB, payload, {
      jobId: translation.id,
    });

    return {
      id: translation.id,
      status: translation.status,
      targetLanguageCode: translation.targetLanguageCode,
    };
  }
}
