import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import { Prisma } from '@/generated/prisma/client';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { slugify } from '@/common/utils';
import {
  createChapterContentDocument,
  type ChapterRecord,
  ChapterResultMapper,
  createBackfilledChapterContentDocument,
  isChapterContentDocument,
  countChapterWords,
  ChapterTitleValueObject,
  ChapterVersionConflictException,
} from '@/modules/chapters';
import type {
  ReviewTranslationInput,
  TranslationReviewPort,
} from '../../application/ports/translation-review.port';
import { computeChapterTranslationHash } from '../../application/chapter-translation/chapter-translation-hash.util';
import { toDomainChapterTranslationRecord } from './prisma-chapter-translation.persistence';

@Injectable()
export class PrismaTranslationReviewPersistence implements TranslationReviewPort {
  constructor(private readonly prisma: PrismaService) {}

  async review(input: ReviewTranslationInput) {
    return this.prisma.$transaction(async (tx) => {
      // Same lock order as chapter saves and contributor permission revocation.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM stories WHERE id = ${input.storyId}::uuid FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM chapters WHERE id = ${input.chapterId}::uuid FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM chapter_translations WHERE id = ${input.translationId}::uuid FOR UPDATE`,
      );
      const current = await tx.chapter.findFirst({
        where: {
          id: input.chapterId,
          storyId: input.storyId,
          deletedAt: null,
          story: {
            deletedAt: null,
            author: { lifecycleStatus: 'ACTIVE' },
            OR: [
              { authorId: input.userId },
              {
                contributors: { some: { userId: input.userId, canEdit: true } },
              },
            ],
          },
        },
        include: { story: { select: { status: true } } },
      });
      const translation = await tx.chapterTranslation.findFirst({
        where: {
          id: input.translationId,
          chapterId: input.chapterId,
          targetLanguageCode: input.targetLanguageCode,
          requestedById: input.userId,
        },
      });
      if (!current || !translation)
        throw new ResourceNotFoundException({
          resource: 'bản dịch thuộc quyền quản lý',
        });
      if (current.version !== input.expectedVersion)
        throw new ChapterVersionConflictException(current.version);
      if (
        translation.generation !== input.generation ||
        translation.status !== 'COMPLETED' ||
        translation.reviewStatus !== 'PENDING'
      )
        throw new ResourceConflictException({
          code: 'TRANSLATION_REVIEW_CONFLICT',
          message: 'Bản dịch đã thay đổi hoặc đã được xử lý. Hãy tải lại.',
        });
      if (current.story.status === 'PENDING_REVIEW')
        throw new ResourceConflictException({
          code: 'CHAPTER_STORY_PENDING_REVIEW',
          message: 'Truyện đang chờ duyệt.',
        });

      const now = new Date();
      let chapter: ChapterRecord | null = null;
      if (input.decision === 'APPROVE') {
        if (current.status !== 'DRAFT')
          throw new ResourceConflictException({
            code: 'CHAPTER_DRAFT_ONLY',
            message:
              'Chỉ nhập bản dịch vào chương nháp. Hãy mở lại bản nháp trước.',
          });
        const hash = computeChapterTranslationHash({
          title: current.title,
          content: current.content,
          targetLanguageCode: input.targetLanguageCode,
        });
        if (hash !== translation.sourceContentHash)
          throw new ResourceConflictException({
            code: 'TRANSLATION_SOURCE_CHANGED',
            message:
              'Nội dung gốc đã thay đổi. Hãy tạo bản dịch mới để tránh mất chỉnh sửa.',
          });
        const title = ChapterTitleValueObject.create(
          input.translatedTitle ?? translation.translatedTitle ?? '',
        ).value;
        const content = (
          input.translatedContent ??
          translation.translatedContent ??
          ''
        ).replace(/\r\n?/gu, '\n');
        if (!content.trim())
          throw new ResourceConflictException({
            code: 'TRANSLATION_EMPTY',
            message: 'Bản dịch không được để trống.',
          });
        const previous = isChapterContentDocument(current.contentDocument)
          ? current.contentDocument
          : createBackfilledChapterContentDocument(current.content, current.id);
        const document = createChapterContentDocument(content, previous);
        const prefix = `chuong-${current.number.toString().replace('.', '-')}`;
        const slug = [
          prefix,
          slugify(title, { maxLength: 255 - prefix.length - 1 }),
        ]
          .filter(Boolean)
          .join('-');
        const wordCount = countChapterWords(content);
        const saved = await tx.chapter.update({
          where: { id: current.id },
          data: {
            title,
            content,
            slug,
            wordCount,
            version: { increment: 1 },
            updatedById: input.userId,
            updatedAt: now,
            contentDocument: document as unknown as Prisma.InputJsonValue,
            documentSchemaVersion: document.schemaVersion,
            versions: {
              create: {
                version: current.version + 1,
                createdById: input.userId,
                title,
                content,
                wordCount,
                contentFormat: current.contentFormat,
                contentDocument: document as unknown as Prisma.InputJsonValue,
                documentSchemaVersion: document.schemaVersion,
                versionType: 'MANUAL_SAVE',
                isRetained: true,
                changeSummary: 'Nhập bản dịch đã duyệt',
                createdAt: now,
              },
            },
          },
        });
        chapter = ChapterResultMapper.toDto({
          ...saved,
          number: saved.number.toNumber(),
          contentDocument: document,
          documentSchemaVersion: document.schemaVersion,
        });
      }
      const reviewed = await tx.chapterTranslation.update({
        where: { id: translation.id },
        data: {
          reviewStatus:
            input.decision === 'APPROVE'
              ? 'APPROVED'
              : input.decision === 'REJECT'
                ? 'REJECTED'
                : 'REVISION_REQUESTED',
          revisionNotes: input.notes ?? null,
          reviewedById: input.userId,
          reviewedAt: now,
          ...(chapter
            ? {
                translatedTitle: chapter.title,
                translatedContent: chapter.content,
              }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          action: 'ai.translation.reviewed',
          entityType: 'chapter',
          entityId: current.id,
          requestId: input.requestId,
          oldValues: {
            version: current.version,
            reviewStatus: translation.reviewStatus,
          },
          newValues: {
            translationId: translation.id,
            generation: translation.generation,
            decision: input.decision,
            version: chapter?.version ?? current.version,
          },
          createdAt: now,
        },
      });
      return {
        translation: toDomainChapterTranslationRecord(reviewed),
        chapter,
      };
    });
  }
}
