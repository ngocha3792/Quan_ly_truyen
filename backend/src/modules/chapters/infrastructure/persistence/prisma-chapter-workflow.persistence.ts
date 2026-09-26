import { Injectable } from '@nestjs/common';
import { ChapterStatus, Prisma } from '@/generated/prisma/client';
import {
  AccessDeniedException,
  ResourceConflictException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import type {
  BulkChapterWorkflowInput,
  BulkChapterWorkflowResult,
  ChapterWorkflowMutation,
  ChapterWorkflowPort,
  ChapterWorkflowRecord,
  SkippedBulkChapter,
} from '../../application/ports/chapter-workflow.port';
import type { ChapterRecord } from '../../application/ports/chapter.persistence.port';
import {
  ChapterBulkActionPolicy,
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
      if (input.action === 'submit' && !chapter.content.trim()) {
        // Chương truyện tranh không có chữ nào: nội dung của nó là các trang
        // ảnh trong chapter_media, nên chỉ đọc `content` là chặn nhầm.
        const pageCount = await tx.chapterMedia.count({
          where: { chapterId: chapter.id },
        });
        if (pageCount === 0)
          throw new ResourceConflictException({
            code: 'CHAPTER_EMPTY_CONTENT',
            message:
              'Chương phải có nội dung hoặc ít nhất một trang ảnh trước khi gửi duyệt',
          });
      }
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

  /**
   * Chạy cùng một `transition` cho từng chương đủ điều kiện, mỗi chương một
   * giao dịch riêng.
   *
   * Không gộp cả lô vào một giao dịch: một chương rỗng làm cả lô quay lui thì
   * người bấm mất hết phần đã duyệt được. Tách ra thì phần xong vẫn xong, phần
   * vướng được kể tên kèm lý do.
   *
   * Gọi lại chính `transition` thay vì viết lại thân nó, nên toàn bộ luật sẵn
   * có vẫn nguyên: quyền, không tự duyệt truyện mình, chặn chương rỗng, ghi bản
   * ghi duyệt, ghi audit log, xoá phiên soạn thảo.
   */
  async transitionMany(
    input: BulkChapterWorkflowInput,
  ): Promise<BulkChapterWorkflowResult> {
    const where: Prisma.ChapterWhereInput = {
      status: ChapterBulkActionPolicy.sourceStatus(input.action),
      deletedAt: null,
      story: {
        deletedAt: null,
        ...(input.storyId ? { id: input.storyId } : {}),
        // Tác giả chỉ gom được chương của truyện mình; admin gom được mọi truyện.
        ...(input.action === 'submit' ? editableStoryWhere(input.userId) : {}),
      },
    };

    const [candidates, total] = await Promise.all([
      this.prisma.chapter.findMany({
        where,
        orderBy: [{ storyId: 'asc' }, { number: 'asc' }],
        take: ChapterBulkActionPolicy.MAX_PER_CALL,
        select: {
          id: true,
          storyId: true,
          number: true,
          title: true,
          version: true,
        },
      }),
      this.prisma.chapter.count({ where }),
    ]);

    const succeeded: ChapterRecord[] = [];
    const skipped: SkippedBulkChapter[] = [];

    for (const candidate of candidates) {
      try {
        succeeded.push(
          await this.transition({
            userId: input.userId,
            storyId: candidate.storyId,
            chapterId: candidate.id,
            /*
             * Đọc version ngoài giao dịch rồi để `transition` kiểm lại bên
             * trong. Tác giả sửa chương đúng lúc này thì nó báo xung đột và
             * chương đó bị bỏ qua, chứ không duyệt một bản chữ không ai đọc.
             */
            expectedVersion: candidate.version,
            action: input.action === 'approve' ? 'APPROVED' : 'submit',
            audit: input.audit,
          }),
        );
      } catch (error: unknown) {
        skipped.push(describeSkippedChapter(candidate, error));
      }
    }

    return {
      succeeded,
      skipped,
      remaining: Math.max(0, total - candidates.length),
    };
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
    const authorActive = chapter.story.author.lifecycleStatus === 'ACTIVE';
    const canMutate = authorActive && chapter.story.status !== 'PENDING_REVIEW';
    return {
      chapter: workflowChapterRecord(chapter),
      storyTitle: chapter.story.title,
      /*
       * Sửa mở ở mọi giai đoạn: chương đang duyệt, đã duyệt, đã hẹn giờ hay
       * đã xuất bản đều sửa được, kể cả khi truyện đang chờ duyệt. Chỉ các
       * bước chuyển trạng thái bên dưới mới còn bị chặn.
       */
      canEdit: authorActive && editable,
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

/**
 * Biến lỗi của một chương thành dòng lý do hiện được cho người bấm.
 *
 * Lỗi miền của repo đều mang `code` và `message` tiếng Việt sẵn, nên dùng lại
 * thay vì tự dịch. Lỗi lạ thì nói thẳng là lạ chứ không nuốt: nuốt đi là người
 * bấm tưởng chương đó không đủ điều kiện, trong khi thật ra hệ thống hỏng.
 */
function describeSkippedChapter(
  chapter: { id: string; number: Prisma.Decimal; title: string },
  error: unknown,
): SkippedBulkChapter {
  const known =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown; message?: unknown })
      : {};

  return {
    chapterId: chapter.id,
    number: chapter.number.toNumber(),
    title: chapter.title,
    code: typeof known.code === 'string' ? known.code : 'CHAPTER_BULK_FAILED',
    message:
      typeof known.message === 'string' && known.message.trim()
        ? known.message
        : 'Không xử lý được chương này',
  };
}
