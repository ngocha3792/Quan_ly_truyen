import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import { ChapterTranslationStatus } from '@/generated/prisma/client';

import {
  ChapterSourceForTranslation,
  ChapterTranslationPersistencePort,
  ChapterTranslationRecord,
  CompleteChapterTranslationInput,
  FailChapterTranslationInput,
  UpsertPendingChapterTranslationInput,
} from '../../application/ports/chapter-translation.persistence.port';

@Injectable()
export class PrismaChapterTranslationPersistence implements ChapterTranslationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findByChapterAndLanguage(
    chapterId: string,
    targetLanguageCode: string,
  ): Promise<ChapterTranslationRecord | null> {
    return this.prisma.chapterTranslation.findUnique({
      where: {
        chapterId_targetLanguageCode: { chapterId, targetLanguageCode },
      },
    });
  }

  async findById(
    translationId: string,
  ): Promise<ChapterTranslationRecord | null> {
    return this.prisma.chapterTranslation.findUnique({
      where: { id: translationId },
    });
  }

  async upsertPending(
    input: UpsertPendingChapterTranslationInput,
  ): Promise<ChapterTranslationRecord> {
    return this.prisma.chapterTranslation.upsert({
      where: {
        chapterId_targetLanguageCode: {
          chapterId: input.chapterId,
          targetLanguageCode: input.targetLanguageCode,
        },
      },
      create: {
        chapterId: input.chapterId,
        targetLanguageCode: input.targetLanguageCode,
        requestedById: input.requestedById,
        connectionId: input.connectionId,
        sourceContentHash: input.sourceContentHash,
        status: ChapterTranslationStatus.PENDING,
      },
      update: {
        requestedById: input.requestedById,
        connectionId: input.connectionId,
        sourceContentHash: input.sourceContentHash,
        status: ChapterTranslationStatus.PENDING,
        translatedTitle: null,
        translatedContent: null,
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  async markProcessing(translationId: string): Promise<void> {
    await this.prisma.chapterTranslation.update({
      where: { id: translationId },
      data: { status: ChapterTranslationStatus.PROCESSING },
    });
  }

  async markCompleted(input: CompleteChapterTranslationInput): Promise<void> {
    await this.prisma.chapterTranslation.update({
      where: { id: input.translationId },
      data: {
        status: ChapterTranslationStatus.COMPLETED,
        translatedTitle: input.translatedTitle,
        translatedContent: input.translatedContent,
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  async markFailed(input: FailChapterTranslationInput): Promise<void> {
    await this.prisma.chapterTranslation.update({
      where: { id: input.translationId },
      data: {
        status: ChapterTranslationStatus.FAILED,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      },
    });
  }

  async findChapterSource(
    chapterId: string,
  ): Promise<ChapterSourceForTranslation | null> {
    return this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { title: true, content: true },
    });
  }
}
