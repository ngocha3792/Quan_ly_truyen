import { Injectable } from '@nestjs/common';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { Prisma } from '@/generated/prisma/client';
import { computeChapterTranslationHash } from '../../application/chapter-translation/chapter-translation-hash.util';

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

export function toDomainChapterTranslationRecord(
  record: PrismaChapterTranslation,
): ChapterTranslationRecord {
  return {
    generation: record.generation,
    sourceVersion: record.sourceVersion,
    reviewStatus: record.reviewStatus,
    revisionNotes: record.revisionNotes,
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
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.chapter.findUnique({
        where: { id: input.chapterId },
        select: { storyId: true },
      });
      if (!before) throw new ResourceNotFoundException({ resource: 'chương' });
      const requester = await tx.user.findFirst({
        where: { id: input.requestedById, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!requester)
        throw new ResourceNotFoundException({ resource: 'người yêu cầu dịch' });
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM stories WHERE id = ${before.storyId}::uuid FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM chapters WHERE id = ${input.chapterId}::uuid FOR UPDATE`,
      );
      const chapter = await tx.chapter.findFirst({
        where: translationSourceWhere(input.chapterId, input.requestedById),
        select: { title: true, content: true, version: true },
      });
      if (!chapter) throw new ResourceNotFoundException({ resource: 'chương' });
      if (
        computeChapterTranslationHash({
          ...chapter,
          targetLanguageCode: input.targetLanguageCode,
        }) !== input.sourceContentHash
      )
        throw new ResourceConflictException({
          code: 'TRANSLATION_SOURCE_CHANGED',
          message: 'Chương đã thay đổi. Hãy tải lại trước khi dịch.',
        });
      const current = await tx.chapterTranslation.findUnique({
        where: {
          chapterId_targetLanguageCode: {
            chapterId: input.chapterId,
            targetLanguageCode: input.targetLanguageCode,
          },
        },
      });
      if (
        current &&
        (current.status === 'PENDING' ||
          (current.status === 'PROCESSING' &&
            current.leaseExpiresAt !== null &&
            current.leaseExpiresAt > new Date())) &&
        current.sourceContentHash === input.sourceContentHash &&
        current.requestedById === input.requestedById &&
        current.connectionId === input.connectionId
      )
        return toDomainChapterTranslationRecord(current);
      const record = await tx.chapterTranslation.upsert({
        where: {
          chapterId_targetLanguageCode: {
            chapterId: input.chapterId,
            targetLanguageCode: input.targetLanguageCode,
          },
        },
        create: {
          sourceVersion: chapter.version,
          chapterId: input.chapterId,
          targetLanguageCode: input.targetLanguageCode,
          requestedById: input.requestedById,
          connectionId: input.connectionId,
          sourceContentHash: input.sourceContentHash,
          status: ChapterTranslationStatus.PENDING,
        },
        update: {
          generation: { increment: 1 },
          sourceVersion: chapter.version,
          reviewStatus: 'PENDING',
          reviewedAt: null,
          reviewedById: null,
          leaseToken: null,
          leaseExpiresAt: null,
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
    });
  }

  async markProcessing(
    translationId: string,
    generation: number,
    leaseToken: string,
  ): Promise<boolean> {
    const result = await this.prisma.chapterTranslation.updateMany({
      where: {
        id: translationId,
        generation,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { status: 'PROCESSING', leaseExpiresAt: { lt: new Date() } },
        ],
      },
      data: {
        status: ChapterTranslationStatus.PROCESSING,
        leaseToken,
        leaseExpiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return result.count === 1;
  }

  async markCompleted(input: CompleteChapterTranslationInput): Promise<void> {
    await this.prisma.chapterTranslation.updateMany({
      where: {
        id: input.translationId,
        generation: input.generation,
        leaseToken: input.leaseToken,
        status: 'PROCESSING',
      },
      data: {
        status: ChapterTranslationStatus.COMPLETED,
        translatedTitle: input.translatedTitle,
        translatedContent: input.translatedContent,
        errorCode: null,
        errorMessage: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
  }

  async markFailed(input: FailChapterTranslationInput): Promise<void> {
    await this.prisma.chapterTranslation.updateMany({
      where: {
        id: input.translationId,
        generation: input.generation,
        leaseToken: input.leaseToken,
      },
      data: {
        status: ChapterTranslationStatus.FAILED,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
  }

  async findChapterSource(
    chapterId: string,
    userId?: string,
  ): Promise<ChapterSourceForTranslation | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!user) return null;
    return this.prisma.chapter.findFirst({
      where: translationSourceWhere(chapterId, userId),
      select: { storyId: true, title: true, content: true, version: true },
    });
  }
}

function translationSourceWhere(
  id: string,
  userId: string,
): Prisma.ChapterWhereInput {
  return {
    id,
    deletedAt: null,
    story: {
      deletedAt: null,
      author: { lifecycleStatus: 'ACTIVE' },
      OR: [
        { authorId: userId },
        { contributors: { some: { userId, canEdit: true } } },
      ],
    },
  };
}
