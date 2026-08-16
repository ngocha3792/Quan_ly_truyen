import { randomUUID } from 'node:crypto';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { ModerationStatus } from '@/generated/prisma/client';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import {
  AbuseRateLimiterService,
  CommentsService,
  CommentWriteAbuseService,
} from '@/modules/comments/application';
import { ModerationService } from '@/modules/moderation/application';
import { UpdateManagedUserStatusCommandHandler } from '@/modules/users/application';

const runId = randomUUID().replaceAll('-', '').slice(0, 12);
let sequence = 0;
const unique = (prefix: string) => `${prefix}-${runId}-${++sequence}`;
const updateUserStatusExecute = jest.fn();

describe('Comment + moderation PostgreSQL invariants', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let comments: CommentsService;
  let moderation: ModerationService;
  let authorId: string;
  let readerA: string;
  let readerB: string;
  let moderatorId: string;
  let storyId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        CommentsService,
        AbuseRateLimiterService,
        CommentWriteAbuseService,
        ModerationService,
        { provide: REDIS_CLIENT, useValue: null },
        { provide: MetricsService, useValue: { recordCommentOperation: jest.fn(), recordCommentReaction: jest.fn(), recordCommentReport: jest.fn(), recordCommentModeration: jest.fn(), recordCommentAbuseBlock: jest.fn() } },
        { provide: UpdateManagedUserStatusCommandHandler, useValue: { execute: updateUserStatusExecute } },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    comments = moduleRef.get(CommentsService);
    moderation = moduleRef.get(ModerationService);
  });

  beforeEach(async () => {
    process.env.COMMENT_ABUSE_RATE_LIMIT_ENABLED = 'false';
    updateUserStatusExecute.mockReset();
    updateUserStatusExecute.mockResolvedValue({});
    authorId = await createUser('author');
    readerA = await createUser('reader-a');
    readerB = await createUser('reader-b');
    moderatorId = await createUser('moderator');
    const pen = unique('pen').toLowerCase();
    await prisma.authorProfile.create({ data: { userId: authorId, penName: pen, slug: pen } });
    const story = await prisma.story.create({
      data: { authorId, title: unique('story'), slug: unique('slug').toLowerCase(), synopsis: 'phase 3 integration' },
    });
    storyId = story.id;
  });

  afterEach(async () => cleanup());
  afterAll(async () => { await cleanup(); await moduleRef.close(); });

  it('keeps bounded reply depth, reaction uniqueness, immutable evidence and subtree counters correct', async () => {
    const root = await prisma.comment.create({
      data: { storyId, userId: readerA, body: 'Root comment' },
    });
    await prisma.story.update({ where: { id: storyId }, data: { commentCount: 1 } });

    const reply1 = await comments.createReply({
      userId: readerB, parentCommentId: root.id, body: 'Depth one reply',
    });
    const reply2 = await comments.createReply({
      userId: readerA, parentCommentId: reply1.id, body: 'Depth two reply',
    });
    expect(reply1).toMatchObject({ depth: 1, storyId, parentId: root.id });
    expect(reply2).toMatchObject({ depth: 2, storyId, parentId: reply1.id });
    await expect(comments.createReply({
      userId: readerB, parentCommentId: reply2.id, body: 'Depth three is invalid',
    })).rejects.toMatchObject({ code: 'COMMENT_REPLY_DEPTH_EXCEEDED' });
    await expect(prisma.story.findUnique({ where: { id: storyId }, select: { commentCount: true } }))
      .resolves.toMatchObject({ commentCount: 3 });

    await comments.setReaction({ userId: readerA, commentId: reply1.id, type: 'LIKE' });
    await comments.setReaction({ userId: readerA, commentId: reply1.id, type: 'LOVE' });
    await expect(prisma.commentReaction.count({ where: { commentId: reply1.id, userId: readerA } })).resolves.toBe(1);
    await expect(prisma.comment.findUnique({ where: { id: reply1.id }, select: { likeCount: true } }))
      .resolves.toMatchObject({ likeCount: 0 });

    const report = await comments.createReport({
      userId: readerA, commentId: reply1.id, reason: 'HARASSMENT', description: 'Nội dung quấy rối cần được xem xét.',
    });
    const original = (await prisma.report.findUnique({ where: { id: report.id }, select: { evidence: true } }))?.evidence as { comment?: { body?: string } };
    expect(original.comment?.body).toBe('Depth one reply');
    await prisma.comment.update({ where: { id: reply1.id }, data: { body: 'Edited current content', editedAt: new Date() } });
    const immutable = (await prisma.report.findUnique({ where: { id: report.id }, select: { evidence: true } }))?.evidence as { comment?: { body?: string } };
    expect(immutable.comment?.body).toBe('Depth one reply');

    await moderation.moderateComment({ actorId: moderatorId, commentId: root.id, operation: 'hide', reason: 'Ẩn thread để xử lý nội dung vi phạm.', audit: { requestId: unique('req') } });
    await expect(prisma.story.findUnique({ where: { id: storyId }, select: { commentCount: true } }))
      .resolves.toMatchObject({ commentCount: 0 });
    await expect(prisma.comment.findUnique({ where: { id: reply1.id }, select: { moderationStatus: true } }))
      .resolves.toMatchObject({ moderationStatus: ModerationStatus.VISIBLE });
    await expect(comments.createReply({ userId: readerA, parentCommentId: reply1.id, body: 'Stale hidden-thread reply' }))
      .rejects.toMatchObject({ code: 'COMMENT_NOT_REPLYABLE' });
    await expect(comments.setReaction({ userId: readerA, commentId: reply1.id, type: 'LIKE' }))
      .rejects.toMatchObject({ code: 'COMMENT_NOT_REACTABLE' });
    await expect(comments.createReport({ userId: moderatorId, commentId: reply1.id, reason: 'SPAM' }))
      .rejects.toMatchObject({ code: 'COMMENT_NOT_REPORTABLE' });

    // The reply is already effectively non-public because its root is hidden.
    // Moderating it directly must not decrement the public counter again.
    await moderation.moderateComment({ actorId: moderatorId, commentId: reply1.id, operation: 'hide', reason: 'Ẩn nhánh trong thread vốn đã không public.', reportId: report.id, audit: { requestId: unique('req') } });
    await expect(prisma.story.findUnique({ where: { id: storyId }, select: { commentCount: true } }))
      .resolves.toMatchObject({ commentCount: 0 });

    await moderation.moderateComment({ actorId: moderatorId, commentId: root.id, operation: 'restore', reason: 'Khôi phục root nhưng giữ nhánh vi phạm bị ẩn.', audit: { requestId: unique('req') } });
    await expect(prisma.story.findUnique({ where: { id: storyId }, select: { commentCount: true } }))
      .resolves.toMatchObject({ commentCount: 1 });

    await moderation.moderateComment({ actorId: moderatorId, commentId: reply1.id, operation: 'restore', reason: 'Khôi phục nhánh sau khi xác nhận an toàn.', reportId: report.id, audit: { requestId: unique('req') } });
    await expect(prisma.story.findUnique({ where: { id: storyId }, select: { commentCount: true } }))
      .resolves.toMatchObject({ commentCount: 3 });

    await moderation.moderateComment({ actorId: moderatorId, commentId: reply1.id, operation: 'hide', reason: 'Ẩn nhánh phản hồi đang được kiểm duyệt.', reportId: report.id, audit: { requestId: unique('req') } });
    await expect(prisma.story.findUnique({ where: { id: storyId }, select: { commentCount: true } }))
      .resolves.toMatchObject({ commentCount: 1 });
    await moderation.moderateComment({ actorId: moderatorId, commentId: reply1.id, operation: 'remove', reason: 'Loại bỏ phản hồi sau khi xác nhận vi phạm.', reportId: report.id, audit: { requestId: unique('req') } });
    await expect(prisma.story.findUnique({ where: { id: storyId }, select: { commentCount: true } }))
      .resolves.toMatchObject({ commentCount: 1 });
    await expect(prisma.moderationAction.count({ where: { commentId: reply1.id } })).resolves.toBeGreaterThanOrEqual(2);
    await expect(prisma.auditLog.count({ where: { entityType: 'comment', entityId: reply1.id } })).resolves.toBeGreaterThanOrEqual(2);
  });


  it('serializes terminal report decisions and routes ban through the Phase 1 lifecycle handler', async () => {
    const target = await prisma.comment.create({ data: { storyId, userId: readerA, body: 'Severe moderation target' } });
    await prisma.story.update({ where: { id: storyId }, data: { commentCount: 1 } });
    const report = await comments.createReport({
      userId: readerB,
      commentId: target.id,
      reason: 'HARASSMENT',
      description: 'Báo cáo đủ chi tiết để moderator xử lý.',
    });

    const decisions = await Promise.allSettled([
      moderation.resolveReport({ actorId: moderatorId, reportId: report.id, note: 'Đã xác nhận và đóng báo cáo này.', audit: { requestId: unique('req') } }),
      moderation.rejectReport({ actorId: moderatorId, reportId: report.id, note: 'Không đủ căn cứ để tiếp tục xử lý.', audit: { requestId: unique('req') } }),
    ]);
    expect(decisions.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(decisions.filter((result) => result.status === 'rejected')).toHaveLength(1);

    await moderation.banUser({
      actorId: moderatorId,
      commentId: target.id,
      reason: 'Tài khoản vi phạm nghiêm trọng và cần bị khóa.',
      reportId: report.id,
      audit: { requestId: unique('req') },
    });
    expect(updateUserStatusExecute).toHaveBeenCalledTimes(1);
    const command = updateUserStatusExecute.mock.calls[0]?.[0];
    expect(command).toMatchObject({ actorUserId: moderatorId, targetUserId: readerA, status: 'BANNED' });
    await expect(prisma.comment.findUnique({ where: { id: target.id }, select: { id: true } })).resolves.toEqual({ id: target.id });
    await expect(prisma.moderationAction.count({ where: { commentId: target.id, action: 'BAN_USER' } })).resolves.toBe(1);
    await expect(prisma.auditLog.count({ where: { entityType: 'comment', entityId: target.id, action: 'comment.moderation.user_banned' } })).resolves.toBe(1);
  });

  it('blocks self-report and duplicate open report', async () => {
    const comment = await prisma.comment.create({ data: { storyId, userId: readerA, body: 'Report target' } });
    await expect(comments.createReport({ userId: readerA, commentId: comment.id, reason: 'SPAM' }))
      .rejects.toMatchObject({ code: 'COMMENT_SELF_REPORT_NOT_ALLOWED' });
    await comments.createReport({ userId: readerB, commentId: comment.id, reason: 'SPAM' });
    await expect(comments.createReport({ userId: readerB, commentId: comment.id, reason: 'HARASSMENT' }))
      .rejects.toMatchObject({ code: 'REPORT_ALREADY_OPEN' });
  });

  async function createUser(prefix: string): Promise<string> {
    const marker = unique(prefix).toLowerCase();
    return (await prisma.user.create({ data: { email: `${marker}@example.test`, username: marker.slice(0, 48), displayName: marker } })).id;
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({ where: { email: { contains: runId } }, select: { id: true } });
    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) return;
    const stories = await prisma.story.findMany({ where: { authorId: { in: userIds } }, select: { id: true } });
    const storyIds = stories.map((story) => story.id);
    if (storyIds.length > 0) {
      await prisma.moderationAction.deleteMany({ where: { storyId: { in: storyIds } } });
      await prisma.report.deleteMany({ where: { storyId: { in: storyIds } } });
      const comments = await prisma.comment.findMany({ where: { storyId: { in: storyIds } }, select: { id: true } });
      const commentIds = comments.map((comment) => comment.id);
      if (commentIds.length > 0) await prisma.commentReaction.deleteMany({ where: { commentId: { in: commentIds } } });
      await prisma.comment.deleteMany({ where: { storyId: { in: storyIds } } });
      await prisma.story.deleteMany({ where: { id: { in: storyIds } } });
    }
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.authorProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
