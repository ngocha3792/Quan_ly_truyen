import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import {
  ChapterTranslation as PrismaChapterTranslation,
  ChapterTranslationStatus,
} from '@/generated/prisma/client';

import {
  ChapterSourceForTranslation,
  ChapterTranslationPersistencePort,
  ChapterTranslationRecord,
  CompleteChapterTranslationInput,
  FailChapterTranslationInput,
  UpsertPendingChapterTranslationInput,
} from '../../application/ports/chapter-translation.persistence.port';
import { toDomainChapterTranslationStatus } from './ai-persistence.mappers';

function toDomainChapterTranslationRecord(
  record: PrismaChapterTranslation,
): ChapterTranslationRecord {
  return {
    id: record.id,
    chapterId: record.chapterId,
    targetLanguageCode: record.targetLanguageCode,
    requestedById: record.requestedById,
    connectionId: record.connectionId,
    status: toDomainChapterTranslationStatus(record.status),
    sourceContentHash: record.sourceContentHash,
    translatedTitle: record.translatedTitle,
    translatedContent: record.translatedContent,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaChapterTranslationPersistence implements ChapterTranslationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findByChapterAndLanguage(
    chapterId: string,
    targetLanguageCode: string,
  ): Promise<ChapterTranslationRecord | null> {
    const record = await this.prisma.chapterTranslation.findUnique({
      where: {
        chapterId_targetLanguageCode: { chapterId, targetLanguageCode },
      },
    });
    return record ? toDomainChapterTranslationRecord(record) : null;
  }

  async findById(
    translationId: string,
  ): Promise<ChapterTranslationRecord | null> {
    const record = await this.prisma.chapterTranslation.findUnique({
      where: { id: translationId },
    });
    return record ? toDomainChapterTranslationRecord(record) : null;
  }

  async upsertPending(
    input: UpsertPendingChapterTranslationInput,
  ): Promise<ChapterTranslationRecord> {
    const record = await this.prisma.chapterTranslation.upsert({
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
    return toDomainChapterTranslationRecord(record);
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
      select: { storyId: true, title: true, content: true },
    });
  }
}
