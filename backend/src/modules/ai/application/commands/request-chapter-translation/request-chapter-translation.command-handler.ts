import { Inject, Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import {
  CHAPTER_PERSISTENCE_PORT,
  ChapterPersistencePort,
} from '@/modules/chapters';

import { ChapterTranslationStatus } from '../../../domain/enums';

import {
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
  ChapterTranslationPersistencePort,
} from '../../ports/chapter-translation.persistence.port';
import {
  CHAPTER_TRANSLATION_QUEUE_PORT,
  ChapterTranslationQueuePort,
} from '../../ports/chapter-translation-queue.port';
import { AiConnectionResolver } from '../../connection-resolution/ai-connection-resolver';
import { computeChapterTranslationHash } from '../../chapter-translation/chapter-translation-hash.util';
import { RequestChapterTranslationCommand } from './request-chapter-translation.command';
import { RequestChapterTranslationResultView } from './request-chapter-translation.view';

@Injectable()
export class RequestChapterTranslationCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly chapters: ChapterPersistencePort,
    @Inject(CHAPTER_TRANSLATION_PERSISTENCE_PORT)
    private readonly translations: ChapterTranslationPersistencePort,
    private readonly resolver: AiConnectionResolver,
    @Inject(CHAPTER_TRANSLATION_QUEUE_PORT)
    private readonly queue: ChapterTranslationQueuePort,
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
      existing.status === ChapterTranslationStatus.COMPLETED &&
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

    await this.queue.enqueue({
      translationId: translation.id,
      chapterId: command.chapterId,
      targetLanguageCode: command.targetLanguageCode,
    });

    return {
      id: translation.id,
      status: translation.status,
      targetLanguageCode: translation.targetLanguageCode,
    };
  }
}
