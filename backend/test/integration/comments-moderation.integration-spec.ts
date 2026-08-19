import { randomUUID } from 'node:crypto';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { ModerationStatus } from '@/generated/prisma/client';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import {
  COMMENT_ABUSE_GUARD_PORT,
  COMMENT_ABUSE_METRICS_PORT,
  COMMENT_ABUSE_RATE_LIMIT_STORE_PORT,
  COMMENT_INTERACTION_PERSISTENCE_PORT,
  COMMENT_WRITE_GUARD_PORT,
  RECENT_COMMENT_READER_PORT,
  CreateCommentReplyCommand,
  CreateCommentReplyCommandHandler,
  CreateCommentReportCommand,
  CreateCommentReportCommandHandler,
  SetCommentReactionCommand,
  SetCommentReactionCommandHandler,
} from '@/modules/comments/application';
import {
  CommentWriteGuardAdapter,
  MetricsCommentAbuseAdapter,
  PrismaCommentInteractionPersistence,
  PrismaRecentCommentReader,
  RedisCommentAbuseGuardAdapter,
  RedisCommentAbuseRateLimitStoreAdapter,
} from '@/modules/comments/infrastructure';
import {
  MODERATION_METRICS_PORT,
  MODERATION_PERSISTENCE_PORT,
  BanUserCommand,
  BanUserCommandHandler,
  ModerateCommentCommand,
  ModerateCommentCommandHandler,
} from '@/modules/moderation/application';
import {
  MetricsModerationAdapter,
  PrismaModerationPersistence,
} from '@/modules/moderation/infrastructure';
import {
  REPORT_REPOSITORY,
  RejectReportCommand,
  RejectReportCommandHandler,
  ResolveReportCommand,
  ResolveReportCommandHandler,
} from '@/modules/reports/application';
import { PrismaReportRepository } from '@/modules/reports/infrastructure';
import { USER_MODERATION_PORT } from '@/modules/users';

const runId = randomUUID().replaceAll('-', '').slice(0, 12);
let sequence = 0;
const unique = (prefix: string) => `${prefix}-${runId}-${++sequence}`;
const userModerationBan = jest.fn();

describe('Comment + moderation PostgreSQL invariants', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let comments: ReturnType<typeof createCommentsFacade>;
  let moderation: ReturnType<typeof createModerationFacade>;
  let reports: ReturnType<typeof createReportsFacade>;
  let authorId: string;
  let readerA: string;
  let readerB: string;
  let moderatorId: string;
  let storyId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaCommentInteractionPersistence,
        RedisCommentAbuseGuardAdapter,
        CommentWriteGuardAdapter,
        CreateCommentReplyCommandHandler,
        SetCommentReactionCommandHandler,
        CreateCommentReportCommandHandler,
        PrismaRecentCommentReader,
        RedisCommentAbuseRateLimitStoreAdapter,
        MetricsCommentAbuseAdapter,
        ModerateCommentCommandHandler,
        BanUserCommandHandler,
        PrismaModerationPersistence,
        MetricsModerationAdapter,
        ResolveReportCommandHandler,
        RejectReportCommandHandler,
        PrismaReportRepository,
        { provide: REDIS_CLIENT, useValue: null },
        {
          provide: MetricsService,
          useValue: {
            recordCommentOperation: jest.fn(),
            recordCommentReaction: jest.fn(),
            recordCommentReport: jest.fn(),
            recordCommentModeration: jest.fn(),
            recordCommentAbuseBlock: jest.fn(),
          },
        },
        {
          provide: RECENT_COMMENT_READER_PORT,
          useExisting: PrismaRecentCommentReader,
        },
        {
          provide: COMMENT_ABUSE_RATE_LIMIT_STORE_PORT,
          useExisting: RedisCommentAbuseRateLimitStoreAdapter,
        },
        {
          provide: COMMENT_ABUSE_METRICS_PORT,
          useExisting: MetricsCommentAbuseAdapter,
        },
        {
          provide: COMMENT_ABUSE_GUARD_PORT,
          useExisting: RedisCommentAbuseGuardAdapter,
        },
        {
          provide: COMMENT_WRITE_GUARD_PORT,
          useExisting: CommentWriteGuardAdapter,
        },
        {
          provide: COMMENT_INTERACTION_PERSISTENCE_PORT,
          useExisting: PrismaCommentInteractionPersistence,
        },
        {
          provide: MODERATION_PERSISTENCE_PORT,
          useExisting: PrismaModerationPersistence,
        },
        {
          provide: MODERATION_METRICS_PORT,
          useExisting: MetricsModerationAdapter,
        },
        { provide: REPORT_REPOSITORY, useExisting: PrismaReportRepository },
        {
          provide: USER_MODERATION_PORT,
          useValue: { banUser: userModerationBan },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    comments = createCommentsFacade(
      moduleRef.get(CreateCommentReplyCommandHandler),
      moduleRef.get(SetCommentReactionCommandHandler),
      moduleRef.get(CreateCommentReportCommandHandler),
    );
    moderation = createModerationFacade(
      moduleRef.get(ModerateCommentCommandHandler),
      moduleRef.get(BanUserCommandHandler),
    );
    reports = createReportsFacade(
      moduleRef.get(ResolveReportCommandHandler),
      moduleRef.get(RejectReportCommandHandler),
    );
  });

  beforeEach(async () => {
    process.env.COMMENT_ABUSE_RATE_LIMIT_ENABLED = 'false';
    userModerationBan.mockReset();
    userModerationBan.mockResolvedValue(undefined);
    authorId = await createUser('author');
    readerA = await createUser('reader-a');
    readerB = await createUser('reader-b');
    moderatorId = await createUser('moderator');
    const pen = unique('pen').toLowerCase();
    await prisma.authorProfile.create({
      data: { userId: authorId, penName: pen, slug: pen },
    });
    const story = await prisma.story.create({
      data: {
        authorId,
        title: unique('story'),
        slug: unique('slug').toLowerCase(),
        synopsis: 'phase 3 integration',
      },
    });
    storyId = story.id;
  });

  afterEach(async () => cleanup());
  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('keeps bounded reply depth, reaction uniqueness, immutable evidence and subtree counters correct', async () => {
    const root = await prisma.comment.create({
      data: { storyId, userId: readerA, body: 'Root comment' },
    });
    await prisma.story.update({
      where: { id: storyId },
      data: { commentCount: 1 },
    });

    const reply1 = await comments.createReply({
      userId: readerB,
      parentCommentId: root.id,
      body: 'Depth one reply',
    });
    const reply2 = await comments.createReply({
      userId: readerA,
      parentCommentId: reply1.id,
      body: 'Depth two reply',
    });
    expect(reply1).toMatchObject({ depth: 1, storyId, parentId: root.id });
    expect(reply2).toMatchObject({ depth: 2, storyId, parentId: reply1.id });
    await expect(
      comments.createReply({
        userId: readerB,
        parentCommentId: reply2.id,
        body: 'Depth three is invalid',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_REPLY_DEPTH_EXCEEDED' });
    await expect(
      prisma.story.findUnique({
        where: { id: storyId },
        select: { commentCount: true },
      }),
    ).resolves.toMatchObject({ commentCount: 3 });

    await comments.setReaction({
      userId: readerA,
      commentId: reply1.id,
      type: 'LIKE',
    });
    await comments.setReaction({
      userId: readerA,
      commentId: reply1.id,
      type: 'LOVE',
    });
    await expect(
      prisma.commentReaction.count({
        where: { commentId: reply1.id, userId: readerA },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.comment.findUnique({
        where: { id: reply1.id },
        select: { likeCount: true },
      }),
    ).resolves.toMatchObject({ likeCount: 0 });

    const report = await comments.createReport({
      userId: readerA,
      commentId: reply1.id,
      reason: 'HARASSMENT',
      description: 'Nội dung quấy rối cần được xem xét.',
    });
    const original = (
      await prisma.report.findUnique({
        where: { id: report.id },
        select: { evidence: true },
      })
    )?.evidence as { comment?: { body?: string } };
    expect(original.comment?.body).toBe('Depth one reply');
    await prisma.comment.update({
      where: { id: reply1.id },
      data: { body: 'Edited current content', editedAt: new Date() },
    });
    const immutable = (
      await prisma.report.findUnique({
        where: { id: report.id },
        select: { evidence: true },
      })
    )?.evidence as { comment?: { body?: string } };
    expect(immutable.comment?.body).toBe('Depth one reply');

    await moderation.moderateComment({
      actorId: moderatorId,
      commentId: root.id,
      operation: 'hide',
      reason: 'Ẩn thread để xử lý nội dung vi phạm.',
      audit: { requestId: unique('req') },
    });
    await expect(
      prisma.story.findUnique({
        where: { id: storyId },
        select: { commentCount: true },
      }),
    ).resolves.toMatchObject({ commentCount: 0 });
    await expect(
      prisma.comment.findUnique({
        where: { id: reply1.id },
        select: { moderationStatus: true },
      }),
    ).resolves.toMatchObject({ moderationStatus: ModerationStatus.VISIBLE });
    await expect(
      comments.createReply({
        userId: readerA,
        parentCommentId: reply1.id,
        body: 'Stale hidden-thread reply',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_NOT_REPLYABLE' });
    await expect(
      comments.setReaction({
        userId: readerA,
        commentId: reply1.id,
        type: 'LIKE',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_NOT_REACTABLE' });
    await expect(
      comments.createReport({
        userId: moderatorId,
        commentId: reply1.id,
        reason: 'SPAM',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_NOT_REPORTABLE' });

    // The reply is already effectively non-public because its root is hidden.
    // Moderating it directly must not decrement the public counter again.
    await moderation.moderateComment({
      actorId: moderatorId,
      commentId: reply1.id,
      operation: 'hide',
      reason: 'Ẩn nhánh trong thread vốn đã không public.',
      reportId: report.id,
      audit: { requestId: unique('req') },
    });
    await expect(
      prisma.story.findUnique({
        where: { id: storyId },
        select: { commentCount: true },
      }),
    ).resolves.toMatchObject({ commentCount: 0 });

    await moderation.moderateComment({
      actorId: moderatorId,
      commentId: root.id,
      operation: 'restore',
      reason: 'Khôi phục root nhưng giữ nhánh vi phạm bị ẩn.',
      audit: { requestId: unique('req') },
    });
    await expect(
      prisma.story.findUnique({
        where: { id: storyId },
        select: { commentCount: true },
      }),
    ).resolves.toMatchObject({ commentCount: 1 });

    await moderation.moderateComment({
      actorId: moderatorId,
      commentId: reply1.id,
      operation: 'restore',
      reason: 'Khôi phục nhánh sau khi xác nhận an toàn.',
      reportId: report.id,
      audit: { requestId: unique('req') },
    });
    await expect(
      prisma.story.findUnique({
        where: { id: storyId },
        select: { commentCount: true },
      }),
    ).resolves.toMatchObject({ commentCount: 3 });

    await moderation.moderateComment({
      actorId: moderatorId,
      commentId: reply1.id,
      operation: 'hide',
      reason: 'Ẩn nhánh phản hồi đang được kiểm duyệt.',
      reportId: report.id,
      audit: { requestId: unique('req') },
    });
    await expect(
      prisma.story.findUnique({
        where: { id: storyId },
        select: { commentCount: true },
      }),
    ).resolves.toMatchObject({ commentCount: 1 });
    await moderation.moderateComment({
      actorId: moderatorId,
      commentId: reply1.id,
      operation: 'remove',
      reason: 'Loại bỏ phản hồi sau khi xác nhận vi phạm.',
      reportId: report.id,
      audit: { requestId: unique('req') },
    });
    await expect(
      prisma.story.findUnique({
        where: { id: storyId },
        select: { commentCount: true },
      }),
    ).resolves.toMatchObject({ commentCount: 1 });
    await expect(
      prisma.moderationAction.count({ where: { commentId: reply1.id } }),
    ).resolves.toBeGreaterThanOrEqual(2);
    await expect(
      prisma.auditLog.count({
        where: { entityType: 'comment', entityId: reply1.id },
      }),
    ).resolves.toBeGreaterThanOrEqual(2);
  });

  it('serializes terminal report decisions and routes ban through the users public moderation port', async () => {
    const target = await prisma.comment.create({
      data: { storyId, userId: readerA, body: 'Severe moderation target' },
    });
    await prisma.story.update({
      where: { id: storyId },
      data: { commentCount: 1 },
    });
    const report = await comments.createReport({
      userId: readerB,
      commentId: target.id,
      reason: 'HARASSMENT',
      description: 'Báo cáo đủ chi tiết để moderator xử lý.',
    });

    const decisions = await Promise.allSettled([
      reports.resolve({
        actorId: moderatorId,
        reportId: report.id,
        note: 'Đã xác nhận và đóng báo cáo này.',
        audit: { requestId: unique('req') },
      }),
      reports.reject({
        actorId: moderatorId,
        reportId: report.id,
        note: 'Không đủ căn cứ để tiếp tục xử lý.',
        audit: { requestId: unique('req') },
      }),
    ]);
    expect(
      decisions.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      decisions.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    await moderation.banUser({
      actorId: moderatorId,
      commentId: target.id,
      reason: 'Tài khoản vi phạm nghiêm trọng và cần bị khóa.',
      reportId: report.id,
      audit: { requestId: unique('req') },
    });
    expect(userModerationBan).toHaveBeenCalledTimes(1);
    expect(userModerationBan).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: moderatorId,
        targetUserId: readerA,
        reason: 'Tài khoản vi phạm nghiêm trọng và cần bị khóa.',
      }),
    );
    await expect(
      prisma.comment.findUnique({
        where: { id: target.id },
        select: { id: true },
      }),
    ).resolves.toEqual({ id: target.id });
    await expect(
      prisma.moderationAction.count({
        where: { commentId: target.id, action: 'BAN_USER' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: {
          entityType: 'comment',
          entityId: target.id,
          action: 'comment.moderation.user_banned',
        },
      }),
    ).resolves.toBe(1);
  });

  it('blocks self-report and duplicate open report', async () => {
    const comment = await prisma.comment.create({
      data: { storyId, userId: readerA, body: 'Report target' },
    });
    await expect(
      comments.createReport({
        userId: readerA,
        commentId: comment.id,
        reason: 'SPAM',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_SELF_REPORT_NOT_ALLOWED' });
    await comments.createReport({
      userId: readerB,
      commentId: comment.id,
      reason: 'SPAM',
    });
    await expect(
      comments.createReport({
        userId: readerB,
        commentId: comment.id,
        reason: 'HARASSMENT',
      }),
    ).rejects.toMatchObject({ code: 'REPORT_ALREADY_OPEN' });
  });

  async function createUser(prefix: string): Promise<string> {
    const marker = unique(prefix).toLowerCase();
    return (
      await prisma.user.create({
        data: {
          email: `${marker}@example.test`,
          username: marker.slice(0, 48),
          displayName: marker,
        },
      })
    ).id;
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { contains: runId } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) return;
    const stories = await prisma.story.findMany({
      where: { authorId: { in: userIds } },
      select: { id: true },
    });
    const storyIds = stories.map((story) => story.id);
    if (storyIds.length > 0) {
      const comments = await prisma.comment.findMany({
        where: { storyId: { in: storyIds } },
        select: { id: true },
      });
      const commentIds = comments.map((comment) => comment.id);
      if (commentIds.length > 0) {
        await prisma.commentReaction.deleteMany({
          where: { commentId: { in: commentIds } },
        });
      }
      await prisma.moderationAction.deleteMany({
        where: {
          OR: [
            { commentId: { in: commentIds } },
            { storyId: { in: storyIds } },
            { actorId: { in: userIds } },
            { targetUserId: { in: userIds } },
          ],
        },
      });
      await prisma.report.deleteMany({
        where: {
          OR: [
            { commentId: { in: commentIds } },
            { storyId: { in: storyIds } },
            { reporterId: { in: userIds } },
            { reportedUserId: { in: userIds } },
          ],
        },
      });
      await prisma.comment.deleteMany({ where: { storyId: { in: storyIds } } });
      await prisma.story.deleteMany({ where: { id: { in: storyIds } } });
    }
    await prisma.moderationAction.deleteMany({
      where: {
        OR: [{ actorId: { in: userIds } }, { targetUserId: { in: userIds } }],
      },
    });
    await prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: { in: userIds } },
          { reportedUserId: { in: userIds } },
        ],
      },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.authorProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

function createCommentsFacade(
  replies: CreateCommentReplyCommandHandler,
  reactions: SetCommentReactionCommandHandler,
  reports: CreateCommentReportCommandHandler,
) {
  return {
    createReply: (
      input: ConstructorParameters<typeof CreateCommentReplyCommand>[0],
    ) => replies.execute(new CreateCommentReplyCommand(input)),
    setReaction: (
      input: ConstructorParameters<typeof SetCommentReactionCommand>[0],
    ) => reactions.execute(new SetCommentReactionCommand(input)),
    createReport: (
      input: ConstructorParameters<typeof CreateCommentReportCommand>[0],
    ) => reports.execute(new CreateCommentReportCommand(input)),
  };
}

function createModerationFacade(
  moderate: ModerateCommentCommandHandler,
  ban: BanUserCommandHandler,
) {
  return {
    moderateComment: (input: {
      actorId: string;
      commentId: string;
      operation: ConstructorParameters<typeof ModerateCommentCommand>[2];
      reason: string;
      reportId?: string;
      audit: ConstructorParameters<typeof ModerateCommentCommand>[5];
    }) =>
      moderate.execute(
        new ModerateCommentCommand(
          input.actorId,
          input.commentId,
          input.operation,
          input.reason,
          input.reportId,
          input.audit,
        ),
      ),
    banUser: (input: {
      actorId: string;
      commentId: string;
      reason: string;
      reportId?: string;
      audit: ConstructorParameters<typeof BanUserCommand>[4];
    }) =>
      ban.execute(
        new BanUserCommand(
          input.actorId,
          input.commentId,
          input.reason,
          input.reportId,
          input.audit,
        ),
      ),
  };
}

function createReportsFacade(
  resolve: ResolveReportCommandHandler,
  reject: RejectReportCommandHandler,
) {
  return {
    resolve: (input: {
      actorId: string;
      reportId: string;
      note: string;
      audit: ConstructorParameters<typeof ResolveReportCommand>[3];
    }) =>
      resolve.execute(
        new ResolveReportCommand(
          input.actorId,
          input.reportId,
          input.note,
          input.audit,
        ),
      ),
    reject: (input: {
      actorId: string;
      reportId: string;
      note: string;
      audit: ConstructorParameters<typeof RejectReportCommand>[3];
    }) =>
      reject.execute(
        new RejectReportCommand(
          input.actorId,
          input.reportId,
          input.note,
          input.audit,
        ),
      ),
  };
}
