import { Injectable } from '@nestjs/common';
import { ChapterStatus, Prisma } from '@/generated/prisma/client';
import {
  AccessDeniedException,
  ResourceConflictException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import type {
  ChapterWorkflowMutation,
  ChapterWorkflowPort,
  ChapterWorkflowRecord,
} from '../../application/ports/chapter-workflow.port';
import {
  ChapterNotFoundException,
  ChapterVersionConflictException,
} from '../../domain';
import { ChapterWorkflowPolicy } from '../../domain/policies/chapter-workflow.policy';
import { editableStoryWhere } from './chapter-edit-access';
import {
  workflowChapterRecord,
  workflowSnapshot,
} from './chapter-workflow.mapper';

const reviewInclude = { reviewer: { select: { displayName: true } } } as const;
const storyInclude = {
  author: { select: { lifecycleStatus: true } },
  contributors: { select: { userId: true, canEdit: true } },
} as const;

@Injectable()
export class PrismaChapterWorkflowPersistence implements ChapterWorkflowPort {
  constructor(private readonly prisma: PrismaService) {}

  async transition(input: ChapterWorkflowMutation) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.chapter.findUnique({
        where: { id: input.chapterId },
        select: { storyId: true },
      });
      if (!before) throw new ChapterNotFoundException();
      // All chapter mutations use the same story -> chapter lock order.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM stories WHERE id = ${before.storyId}::uuid FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM chapters WHERE id = ${input.chapterId}::uuid FOR UPDATE`,
      );
      const chapter = await tx.chapter.findFirst({
        where: {
          id: input.chapterId,
          deletedAt: null,
          story: { deletedAt: null },
        },
        include: { story: { include: storyInclude } },
      });
      if (!chapter || (input.storyId && chapter.storyId !== input.storyId))
        throw new ChapterNotFoundException();
      const authorAction =
        input.action === 'submit' || input.action === 'reopen';
      if (authorAction) {
        if (
          chapter.story.authorId !== input.userId ||
          chapter.story.author.lifecycleStatus !== 'ACTIVE'
        ) {
          throw new AccessDeniedException({
            message:
              'Chỉ tác giả đang hoạt động được gửi duyệt hoặc mở lại chương',
          });
        }
        if (chapter.story.status === 'PENDING_REVIEW')
          throw new ResourceConflictException({
            message: 'Truyện đang chờ duyệt',
          });
      } else {
        await assertChapterReviewer(tx, input.userId);
        if (
          chapter.story.authorId === input.userId ||
          chapter.story.contributors.some(
            (item) => item.userId === input.userId,
          )
        ) {
          throw new AccessDeniedException({
            message: 'Không thể tự duyệt chương của truyện bạn tham gia',
          });
        }
      }
      if (chapter.version !== input.expectedVersion)
        throw new ChapterVersionConflictException(chapter.version);
      const next = ChapterWorkflowPolicy.nextStatus(
        chapter.status,
        input.action,
      );
      if (!next)
        throw new ResourceConflictException({
          code: 'CHAPTER_INVALID_TRANSITION',
          message: 'Trạng thái chương đã thay đổi hoặc thao tác không hợp lệ',
        });
      if (input.action === 'submit' && !chapter.content.trim())
        throw new ResourceConflictException({
          code: 'CHAPTER_EMPTY_CONTENT',
          message: 'Chương phải có nội dung trước khi gửi duyệt',
        });
      const now = new Date();
      const version = chapter.version + 1;
      if (!authorAction) {
        await tx.chapterReview.create({
          data: {
            chapterId: chapter.id,
            reviewerId: input.userId,
            decision: input.action as
              'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES',
            comment: input.comment,
            reviewedVersion: chapter.version,
            createdAt: now,
          },
        });
      }
      const updated = await tx.chapter.update({
        where: { id: chapter.id },
        data: {
          status: next as ChapterStatus,
          version,
          updatedById: input.userId,
          versions: {
            create: workflowSnapshot(
              chapter,
              input.userId,
              version,
              `Workflow: ${input.action}`,
            ),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          action: `chapter.workflow.${input.action.toLowerCase()}`,
          entityType: 'chapter',
          entityId: chapter.id,
          oldValues: { status: chapter.status, version: chapter.version },
          newValues: {
            status: next,
            version,
            reviewedVersion: chapter.version,
          },
          ...input.audit,
          createdAt: now,
        },
      });
      await tx.chapterEditSession.deleteMany({
        where: { chapterId: chapter.id },
      });
      return workflowChapterRecord(updated);
    });
  }

  async get(
    userId: string,
    chapterId: string,
    storyId?: string,
  ): Promise<ChapterWorkflowRecord> {
    if (!storyId) await assertChapterReviewer(this.prisma, userId);
    const chapter = await this.prisma.chapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        ...(storyId
          ? { storyId, story: editableStoryWhere(userId) }
          : { story: { deletedAt: null } }),
      },
      include: {
        story: { include: storyInclude },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: reviewInclude,
        },
      },
    });
    if (!chapter) throw new ChapterNotFoundException();
    const owner =
      chapter.story.authorId === userId &&
      chapter.story.author.lifecycleStatus === 'ACTIVE';
    const editable =
      owner ||
      chapter.story.contributors.some(
        (item) => item.userId === userId && item.canEdit,
      );
    const canMutate =
      chapter.story.author.lifecycleStatus === 'ACTIVE' &&
      chapter.story.status !== 'PENDING_REVIEW';
    return {
      chapter: workflowChapterRecord(chapter),
      storyTitle: chapter.story.title,
      canEdit: canMutate && editable && chapter.status === 'DRAFT',
      canSubmit: canMutate && owner && chapter.status === 'DRAFT',
      canReopen: canMutate && owner && chapter.status === 'APPROVED',
      canPublish:
        owner &&
        chapter.story.status === 'PUBLISHED' &&
        ChapterWorkflowPolicy.canPublish(chapter.status),
      reviews: chapter.reviews.map(({ reviewer, ...review }) => ({
        ...review,
        reviewerName: reviewer.displayName,
      })),
    };
  }

  async listReviews(userId: string, page: number, pageSize: number) {
    await assertChapterReviewer(this.prisma, userId);
    const where = {
      status: ChapterStatus.IN_REVIEW,
      deletedAt: null,
      story: { deletedAt: null },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.chapter.count({ where }),
      this.prisma.chapter.findMany({
        where,
        select: { id: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const items = await Promise.all(
      rows.map((row) => this.get(userId, row.id)),
    );
    return { items, total, page, pageSize };
  }
}

export async function assertChapterReviewer(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const permission = await tx.userRole.findFirst({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      user: { status: 'ACTIVE', deletedAt: null },
      role: {
        permissions: { some: { permission: { code: 'chapter.manage.any' } } },
      },
    },
    select: { roleId: true },
  });
  if (!permission)
    throw new AccessDeniedException({
      message: 'Bạn không có quyền duyệt chương',
    });
}
