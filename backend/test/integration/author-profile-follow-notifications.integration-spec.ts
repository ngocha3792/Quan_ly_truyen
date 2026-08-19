import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';

import { AppConfigModule } from '@/config';
import {
  AccountStatus,
  AuthorLifecycleStatus,
  AuthorVerificationStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  StoryStatus,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { TracePropagationService } from '@/infrastructure/observability';
import {
  AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
  type AuthorChapterPublishedNotificationV1,
  type OutboxQueueEnvelope,
} from '@/infrastructure/queue/contracts';
import {
  AUTHOR_PROFILE_PERSISTENCE_PORT,
  UpdateAuthorProfileCommand,
  UpdateAuthorProfileCommandHandler,
} from '@/modules/authors/application';
import { PrismaAuthorProfilePersistence } from '@/modules/authors/infrastructure';
import {
  FOLLOW_REPOSITORY,
  FollowAuthorCommand,
  FollowAuthorCommandHandler,
  UnfollowAuthorCommand,
  UnfollowAuthorCommandHandler,
} from '@/modules/follows/application';
import { PrismaFollowRepository } from '@/modules/follows/infrastructure';
import { PrismaChapterPersistence } from '@/modules/chapters/infrastructure';
import { NotificationsFanoutProcessor } from '@/modules/notifications/infrastructure/queue/notifications-fanout.processor';
import { PrismaAccountDeletionPersistence } from '@/modules/auth/infrastructure/persistence/prisma/repositories/prisma-account-deletion.persistence';

const runId = randomUUID().replaceAll('-', '').slice(0, 10);
let sequence = 0;
const createdUserIds = new Set<string>();
const unique = (prefix: string) => `${prefix}-${runId}-${++sequence}`;

describe('Phase 5 author profile, follows and notifications', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let updateProfile: UpdateAuthorProfileCommandHandler;
  let followAuthor: FollowAuthorCommandHandler;
  let unfollowAuthor: UnfollowAuthorCommandHandler;
  let fanout: NotificationsFanoutProcessor;
  let chapters: PrismaChapterPersistence;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaAuthorProfilePersistence,
        {
          provide: AUTHOR_PROFILE_PERSISTENCE_PORT,
          useExisting: PrismaAuthorProfilePersistence,
        },
        UpdateAuthorProfileCommandHandler,
        PrismaFollowRepository,
        { provide: FOLLOW_REPOSITORY, useExisting: PrismaFollowRepository },
        FollowAuthorCommandHandler,
        UnfollowAuthorCommandHandler,
        PrismaChapterPersistence,
        NotificationsFanoutProcessor,
        {
          provide: TracePropagationService,
          useValue: {
            runWithQueueContext: (
              _telemetry: unknown,
              _context: unknown,
              work: () => unknown,
            ) => work(),
          },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    updateProfile = moduleRef.get(UpdateAuthorProfileCommandHandler);
    followAuthor = moduleRef.get(FollowAuthorCommandHandler);
    unfollowAuthor = moduleRef.get(UnfollowAuthorCommandHandler);
    fanout = moduleRef.get(NotificationsFanoutProcessor);
    chapters = moduleRef.get(PrismaChapterPersistence);
  });

  afterEach(async () => cleanup());
  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('updates canonical author profile fields, keeps slug stable and validates owned media', async () => {
    const authorId = await createAuthor('profile');
    const avatar = await createMedia(authorId, MediaPurpose.AVATAR);
    const banner = await createMedia(authorId, MediaPurpose.AUTHOR_BANNER);
    const otherUser = await createUser('other');
    const foreignAvatar = await createMedia(otherUser, MediaPurpose.AVATAR);

    await prisma.authorProfile.update({
      where: { userId: authorId },
      data: { socialLinks: { country: 'VN', legacyKey: 'keep-me' } },
    });
    const before = await prisma.authorProfile.findUniqueOrThrow({
      where: { userId: authorId },
    });

    const updated = await updateProfile.execute(
      new UpdateAuthorProfileCommand({
        userId: authorId,
        displayName: '  Kiếm   Khách  ',
        bio: 'Tiểu sử tác giả',
        avatarMediaId: avatar.id,
        bannerMediaId: banner.id,
        socialLinks: {
          website: 'https://example.test/me',
          facebook: 'https://facebook.com/example',
        },
        audit: { requestId: unique('request') },
      }),
    );

    expect(updated.displayName).toBe('Kiếm Khách');
    expect(updated.slug).toBe(before.slug);
    expect(updated.avatar?.id).toBe(avatar.id);
    expect(updated.banner?.id).toBe(banner.id);
    const persisted = await prisma.authorProfile.findUniqueOrThrow({
      where: { userId: authorId },
    });
    expect((persisted.socialLinks as Record<string, unknown>)['country']).toBe(
      'VN',
    );
    expect(
      (persisted.socialLinks as Record<string, unknown>)['legacyKey'],
    ).toBe('keep-me');
    expect(
      await prisma.auditLog.count({
        where: { actorId: authorId, action: 'author.profile.updated' },
      }),
    ).toBe(1);

    await expect(
      updateProfile.execute(
        new UpdateAuthorProfileCommand({
          userId: authorId,
          avatarMediaId: foreignAvatar.id,
          audit: {},
        }),
      ),
    ).rejects.toMatchObject({ code: 'AUTHOR_AVATAR_INVALID' });
  });

  it('keeps display-name uniqueness race-safe at the database boundary', async () => {
    const firstAuthor = await createAuthor('name-race-a');
    const secondAuthor = await createAuthor('name-race-b');

    const results = await Promise.allSettled([
      updateProfile.execute(
        new UpdateAuthorProfileCommand({
          userId: firstAuthor,
          displayName: 'Phase Five Shared Name',
          audit: {},
        }),
      ),
      updateProfile.execute(
        new UpdateAuthorProfileCommand({
          userId: secondAuthor,
          displayName: '  PHASE   FIVE SHARED NAME  ',
          audit: {},
        }),
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toBeDefined();
    expect(rejected?.reason).toMatchObject({
      code: 'AUTHOR_DISPLAY_NAME_UNAVAILABLE',
    });
  });

  it('keeps one follow relation and an exact denormalized count under duplicate concurrent follow', async () => {
    const authorId = await createAuthor('follow-author');
    const readerId = await createUser('follow-reader');

    const [first, second] = await Promise.all([
      followAuthor.execute(new FollowAuthorCommand(readerId, authorId)),
      followAuthor.execute(new FollowAuthorCommand(readerId, authorId)),
    ]);

    expect(first.isFollowing).toBe(true);
    expect(second.isFollowing).toBe(true);
    expect(
      await prisma.userFollowAuthor.count({
        where: { userId: readerId, authorId },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.authorProfile.findUniqueOrThrow({
          where: { userId: authorId },
        })
      ).followerCount,
    ).toBe(1);

    await unfollowAuthor.execute(new UnfollowAuthorCommand(readerId, authorId));
    await unfollowAuthor.execute(new UnfollowAuthorCommand(readerId, authorId));
    expect(
      await prisma.userFollowAuthor.count({
        where: { userId: readerId, authorId },
      }),
    ).toBe(0);
    expect(
      (
        await prisma.authorProfile.findUniqueOrThrow({
          where: { userId: authorId },
        })
      ).followerCount,
    ).toBe(0);
  });

  it('blocks new follows to suspended authors while allowing an existing relation to be removed', async () => {
    const authorId = await createAuthor('suspended-author');
    const readerId = await createUser('suspended-reader');
    await followAuthor.execute(new FollowAuthorCommand(readerId, authorId));
    await prisma.authorProfile.update({
      where: { userId: authorId },
      data: { lifecycleStatus: AuthorLifecycleStatus.SUSPENDED },
    });

    const otherReader = await createUser('other-reader');
    await expect(
      followAuthor.execute(new FollowAuthorCommand(otherReader, authorId)),
    ).rejects.toMatchObject({
      code: 'AUTHOR_NOT_FOLLOWABLE',
    });
    await expect(
      unfollowAuthor.execute(new UnfollowAuthorCommand(readerId, authorId)),
    ).resolves.toMatchObject({
      isFollowing: false,
    });
  });

  it('reconciles outgoing and incoming author follows during account deletion', async () => {
    const deletion = new PrismaAccountDeletionPersistence(prisma, {
      write: jest.fn().mockResolvedValue(undefined),
    } as never);

    const targetAuthor = await createAuthor('delete-target');
    const deletingReader = await createUser('delete-reader', {
      passwordHash: 'phase5-reader-hash',
    });
    const readerSession = await createSession(deletingReader);
    await followAuthor.execute(
      new FollowAuthorCommand(deletingReader, targetAuthor),
    );

    await expect(
      deletion.deleteAccount({
        userId: deletingReader,
        currentSessionId: readerSession,
        expectedPasswordHash: 'phase5-reader-hash',
        deletedAt: new Date(),
      }),
    ).resolves.toMatchObject({ status: 'deleted' });
    await expect(
      prisma.userFollowAuthor.count({
        where: { userId: deletingReader, authorId: targetAuthor },
      }),
    ).resolves.toBe(0);
    expect(
      (
        await prisma.authorProfile.findUniqueOrThrow({
          where: { userId: targetAuthor },
        })
      ).followerCount,
    ).toBe(0);

    const deletingAuthor = await createAuthor('delete-author');
    await prisma.user.update({
      where: { id: deletingAuthor },
      data: { passwordHash: 'phase5-author-hash' },
    });
    const authorSession = await createSession(deletingAuthor);
    const remainingReader = await createUser('remaining-reader');
    await followAuthor.execute(
      new FollowAuthorCommand(remainingReader, deletingAuthor),
    );

    await expect(
      deletion.deleteAccount({
        userId: deletingAuthor,
        currentSessionId: authorSession,
        expectedPasswordHash: 'phase5-author-hash',
        deletedAt: new Date(),
      }),
    ).resolves.toMatchObject({ status: 'deleted' });
    await expect(
      prisma.userFollowAuthor.count({ where: { authorId: deletingAuthor } }),
    ).resolves.toBe(0);
    const anonymized = await prisma.authorProfile.findUniqueOrThrow({
      where: { userId: deletingAuthor },
    });
    expect(anonymized.followerCount).toBe(0);
    expect(anonymized.penName).toMatch(/^deleted_/);
  });

  it('emits exactly one follower outbox event only when a draft chapter publishes successfully', async () => {
    const authorId = await createAuthor('publish-author');
    const marker = unique('published-story').toLowerCase();
    const story = await prisma.story.create({
      data: {
        authorId,
        title: 'Published story',
        slug: marker,
        synopsis: 'Phase 5 outbox integration',
        status: StoryStatus.PUBLISHED,
        visibility: 'PUBLIC',
        publishedAt: new Date(),
      },
    });
    const chapter = await prisma.chapter.create({
      data: {
        storyId: story.id,
        createdById: authorId,
        updatedById: authorId,
        number: '1',
        title: 'Chương 1',
        slug: 'chuong-1',
        content: 'Nội dung chương',
      },
    });
    const publishedAt = new Date();

    const first = await chapters.publish({
      userId: authorId,
      storyId: story.id,
      chapterId: chapter.id,
      publishedAt,
      audit: { requestId: unique('publish-request') },
    });
    expect(first.status).toBe('published');
    const events = await prisma.outboxEvent.findMany({
      where: { idempotencyKey: `author-chapter-published:${chapter.id}` },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      aggregateType: 'notifications',
      aggregateId: chapter.id,
      eventType: AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
    });

    const second = await chapters.publish({
      userId: authorId,
      storyId: story.id,
      chapterId: chapter.id,
      publishedAt: new Date(publishedAt.getTime() + 1_000),
      audit: {},
    });
    expect(second.status).toBe('not_draft');
    await expect(
      prisma.outboxEvent.count({
        where: { idempotencyKey: `author-chapter-published:${chapter.id}` },
      }),
    ).resolves.toBe(1);
  });

  it('fans out only to eligible current followers and deduplicates worker retries', async () => {
    const authorId = await createAuthor('notify-author');
    const eligible = await createUser('eligible');
    const disabled = await createUser('disabled');
    const afterPublish = await createUser('late');
    const publishedAt = new Date(Date.now() - 60_000);

    await prisma.userFollowAuthor.createMany({
      data: [
        {
          userId: eligible,
          authorId,
          createdAt: new Date(publishedAt.getTime() - 60_000),
        },
        {
          userId: disabled,
          authorId,
          createdAt: new Date(publishedAt.getTime() - 60_000),
        },
        {
          userId: afterPublish,
          authorId,
          createdAt: new Date(publishedAt.getTime() + 10_000),
        },
      ],
    });
    await prisma.notificationPreference.create({
      data: { userId: disabled, newChapterEnabled: false },
    });

    const payload: AuthorChapterPublishedNotificationV1 = {
      version: 1,
      authorId,
      storyId: randomUUID(),
      storySlug: unique('story').toLowerCase(),
      storyTitle: 'Truyện integration',
      chapterId: randomUUID(),
      chapterNumber: '5',
      chapterTitle: 'Chương mới',
      publishedAt: publishedAt.toISOString(),
    };
    const envelope: OutboxQueueEnvelope<AuthorChapterPublishedNotificationV1> =
      {
        aggregateType: 'notifications',
        aggregateId: payload.chapterId,
        eventType: AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
        payload,
        outboxEventId: randomUUID(),
        createdAt: new Date().toISOString(),
        telemetry:
          {} as OutboxQueueEnvelope<AuthorChapterPublishedNotificationV1>['telemetry'],
      };
    const job = {
      name: AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
      data: envelope,
    } as Job<OutboxQueueEnvelope<AuthorChapterPublishedNotificationV1>>;

    await fanout.process(job);
    await fanout.process(job);

    expect(
      await prisma.notification.count({
        where: {
          userId: eligible,
          dedupeKey: `new-chapter:${payload.chapterId}:${eligible}`,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({ where: { userId: disabled } }),
    ).toBe(0);
    expect(
      await prisma.notification.count({ where: { userId: afterPublish } }),
    ).toBe(0);
  });

  it('fans out across cursor batches larger than the worker batch size', async () => {
    const authorId = await createAuthor('batch-author');
    const publishedAt = new Date(Date.now() - 60_000);
    const bulkUsers = Array.from({ length: 501 }, (_, index) => {
      const id = randomUUID();
      createdUserIds.add(id);
      const marker = `batch-${runId}-${index}`;
      return {
        id,
        email: `${marker}@example.test`,
        username: marker,
        displayName: marker,
        status: AccountStatus.ACTIVE,
      };
    });
    await prisma.user.createMany({ data: bulkUsers });
    await prisma.userFollowAuthor.createMany({
      data: bulkUsers.map((user) => ({
        userId: user.id,
        authorId,
        createdAt: new Date(publishedAt.getTime() - 1_000),
      })),
    });

    const payload: AuthorChapterPublishedNotificationV1 = {
      version: 1,
      authorId,
      storyId: randomUUID(),
      storySlug: unique('batch-story').toLowerCase(),
      storyTitle: 'Truyện nhiều follower',
      chapterId: randomUUID(),
      chapterNumber: '8',
      chapterTitle: 'Fanout theo batch',
      publishedAt: publishedAt.toISOString(),
    };
    const job = {
      name: AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
      data: {
        aggregateType: 'notifications',
        aggregateId: payload.chapterId,
        eventType: AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
        payload,
        outboxEventId: randomUUID(),
        createdAt: new Date().toISOString(),
        telemetry:
          {} as OutboxQueueEnvelope<AuthorChapterPublishedNotificationV1>['telemetry'],
      },
    } as Job<OutboxQueueEnvelope<AuthorChapterPublishedNotificationV1>>;

    await expect(fanout.process(job)).resolves.toEqual({
      inserted: 501,
      eligible: 501,
    });
    await expect(
      prisma.notification.count({
        where: {
          dedupeKey: { startsWith: `new-chapter:${payload.chapterId}:` },
        },
      }),
    ).resolves.toBe(501);
  });

  async function createAuthor(prefix: string): Promise<string> {
    const userId = await createUser(prefix);
    const marker = unique(`pen-${prefix}`).toLowerCase();
    await prisma.authorProfile.create({
      data: {
        userId,
        penName: marker,
        slug: marker,
        verificationStatus: AuthorVerificationStatus.VERIFIED,
        lifecycleStatus: AuthorLifecycleStatus.ACTIVE,
      },
    });
    return userId;
  }

  async function createUser(
    prefix: string,
    options: { passwordHash?: string } = {},
  ): Promise<string> {
    const marker = unique(prefix).toLowerCase();
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        username: marker.slice(0, 45),
        displayName: marker,
        status: AccountStatus.ACTIVE,
        passwordHash: options.passwordHash,
      },
    });
    createdUserIds.add(user.id);
    return user.id;
  }

  async function createSession(userId: string): Promise<string> {
    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash: unique('refresh-hash'),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return session.id;
  }

  async function createMedia(userId: string, purpose: MediaPurpose) {
    return prisma.mediaAsset.create({
      data: {
        uploaderId: userId,
        purpose,
        status: MediaStatus.READY,
        resourceType: MediaResourceType.IMAGE,
        storageProvider: 'test',
        secureUrl: `https://cdn.example.test/${unique('media')}.webp`,
        readyAt: new Date(),
      },
    });
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { contains: runId } },
      select: { id: true },
    });
    const ids = [
      ...new Set([...createdUserIds, ...users.map((item) => item.id)]),
    ];
    if (!ids.length) return;
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: ids } },
    });
    await prisma.userFollowAuthor.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { authorId: { in: ids } }] },
    });
    const chapters = await prisma.chapter.findMany({
      where: { story: { authorId: { in: ids } } },
      select: { id: true },
    });
    if (chapters.length) {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateId: { in: chapters.map((item) => item.id) },
          aggregateType: 'notifications',
        },
      });
    }
    await prisma.story.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.mediaAsset.updateMany({
      where: { uploaderId: { in: ids } },
      data: { deletedAt: new Date(), uploaderId: null },
    });
    await prisma.authorProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.mediaAsset.deleteMany({
      where: { secureUrl: { contains: runId } },
    });
    createdUserIds.clear();
  }
});
