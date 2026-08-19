import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { configureApplication } from '@/bootstrap';
import { JwtTokenType, PermissionCode, RoleCode } from '@/common/enums';
import type { AppConfig } from '@/config';
import {
  ChapterStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  StoryStatus,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

const ACCESS_SECRET = 'e2e-access-secret-at-least-32-characters';

const AUTHOR_PERMISSIONS = [
  PermissionCode.STORY_CREATE,
  PermissionCode.STORY_UPDATE_OWN,
  PermissionCode.STORY_DELETE_OWN,
  PermissionCode.STORY_SUBMIT,
  PermissionCode.CHAPTER_CREATE,
  PermissionCode.CHAPTER_UPDATE_OWN,
  PermissionCode.CHAPTER_DELETE_OWN,
  PermissionCode.CHAPTER_PUBLISH_OWN,
  PermissionCode.COMMENT_CREATE,
  PermissionCode.COMMENT_UPDATE_OWN,
  PermissionCode.COMMENT_DELETE_OWN,
  PermissionCode.RATING_CREATE,
  PermissionCode.RATING_UPDATE_OWN,
  PermissionCode.LIBRARY_MANAGE_OWN,
  PermissionCode.READING_HISTORY_MANAGE_OWN,
  PermissionCode.READING_BOOKMARK_MANAGE_OWN,
] as const;

const ADMIN_PERMISSIONS = [
  PermissionCode.STORY_REVIEW,
  PermissionCode.STORY_PUBLISH,
  PermissionCode.AUTHOR_READ,
  PermissionCode.AUTHOR_STATUS_MANAGE,
] as const;

describe('Stories author-to-public HTTP workflow E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = randomUUID();
  const compactRunId = runId.replaceAll('-', '');
  const authorId = randomUUID();
  const intruderId = randomUUID();
  const adminId = randomUUID();
  const authorSessionId = randomUUID();
  const intruderSessionId = randomUUID();
  const intruderSecondSessionId = randomUUID();
  const adminSessionId = randomUUID();

  let categoryId: string | null = null;
  let storyId: string | null = null;
  let coverMediaId: string | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
    configureApplication(app, appConfig);
    await app.init();

    prisma = app.get(PrismaService);
    await seedAuthorization();
  });

  afterAll(async () => {
    await cleanupRun();
    await app.close();
  });

  it('create → chapter → submit → approve → publish → public read, với idempotent replay', async () => {
    const authorToken = token(authorId, authorSessionId);
    const adminToken = token(adminId, adminSessionId);
    const createStoryKey = `story-create-${runId}`;
    const createStoryBody = {
      title: `Workflow E2E ${compactRunId.slice(0, 8)}`,
      synopsis: 'Story đi xuyên write-side tới public reader trong E2E.',
      categoryIds: categoryId ? [categoryId] : [],
    };

    const firstStoryResponse = await request(httpServer())
      .post('/api/v1/author/stories')
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', createStoryKey)
      .send(createStoryBody)
      .expect(201);

    const createdStory = unwrap<{ id: string; slug: string }>(
      firstStoryResponse.body as unknown,
    );
    storyId = createdStory.id;

    const replayStoryResponse = await request(httpServer())
      .post('/api/v1/author/stories')
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', createStoryKey)
      .send(createStoryBody)
      .expect(201);

    expect(replayStoryResponse.headers['x-idempotent-replayed']).toBe('true');
    expect(unwrap<{ id: string }>(replayStoryResponse.body as unknown).id).toBe(
      storyId,
    );
    await expect(prisma.story.count({ where: { id: storyId } })).resolves.toBe(
      1,
    );

    coverMediaId = await createReadyCover(storyId);

    await request(httpServer())
      .patch(`/api/v1/author/stories/${storyId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ coverMediaId })
      .expect(200);

    const chapterBody = {
      title: 'Workflow chapter',
      content: 'Nội dung chapter được publish qua HTTP E2E.',
    };
    const createChapterKey = `chapter-create-${runId}`;
    const firstChapterResponse = await request(httpServer())
      .post(`/api/v1/author/stories/${storyId}/chapters`)
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', createChapterKey)
      .send(chapterBody)
      .expect(201);

    const chapter = unwrap<{ id: string; number: number }>(
      firstChapterResponse.body as unknown,
    );

    const replayChapterResponse = await request(httpServer())
      .post(`/api/v1/author/stories/${storyId}/chapters`)
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', createChapterKey)
      .send(chapterBody)
      .expect(201);

    expect(replayChapterResponse.headers['x-idempotent-replayed']).toBe('true');
    expect(
      unwrap<{ id: string }>(replayChapterResponse.body as unknown).id,
    ).toBe(chapter.id);
    await expect(prisma.chapter.count({ where: { storyId } })).resolves.toBe(1);

    const intruderResponse = await request(httpServer())
      .patch(`/api/v1/author/stories/${storyId}`)
      .set('Authorization', `Bearer ${token(intruderId, intruderSessionId)}`)
      .send({ title: 'Intruder must not mutate this story' });

    expect(intruderResponse.status).toBe(404);

    const submitResponse = await request(httpServer())
      .post(`/api/v1/author/stories/${storyId}/submit`)
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', `story-submit-${runId}`)
      .send({ authorNote: 'Ready for E2E review.' })
      .expect(200);

    const submissionId = unwrap<{
      submission: { id: string };
    }>(submitResponse.body as unknown).submission.id;

    const moderationListResponse = await request(httpServer())
      .get('/api/v1/admin/story-submissions')
      .query({
        status: 'PENDING',
        story: createStoryBody.title,
        page: 1,
        pageSize: 20,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      unwrap<{ items: Array<{ submissionId: string }> }>(
        moderationListResponse.body as unknown,
      ).items,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ submissionId })]),
    );

    const moderationDetailResponse = await request(httpServer())
      .get(`/api/v1/admin/story-submissions/${submissionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      unwrap<{ story: { id: string }; chapters: Array<{ id: string }> }>(
        moderationDetailResponse.body as unknown,
      ),
    ).toMatchObject({
      story: { id: storyId },
      chapters: [expect.objectContaining({ id: chapter.id })],
    });

    await request(httpServer())
      .patch(`/api/v1/author/stories/${storyId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Pending review must be immutable' })
      .expect(409);

    await request(httpServer())
      .post(`/api/v1/admin/story-submissions/${submissionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-idempotency-key', `story-approve-${runId}`)
      .expect(200);

    await request(httpServer())
      .post(`/api/v1/author/stories/${storyId}/chapters/${chapter.id}/publish`)
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', `chapter-publish-${runId}`)
      .expect(200);

    const publicStoryResponse = await request(httpServer())
      .get(`/api/v1/stories/${createdStory.slug}`)
      .expect(200);
    const publicStory = unwrap<{
      id: string;
      status: string;
      latestChapter: { id: string; number: number } | null;
    }>(publicStoryResponse.body as unknown);

    expect(publicStory).toMatchObject({
      id: storyId,
      status: 'ONGOING',
      latestChapter: { id: chapter.id, number: 1 },
    });

    const publicChapterResponse = await request(httpServer())
      .get(`/api/v1/stories/${createdStory.slug}/chapters/1`)
      .expect(200);
    const publicChapter = unwrap<{
      chapter: { id: string; status?: string; content: string };
    }>(publicChapterResponse.body as unknown);

    expect(publicChapter.chapter).toMatchObject({
      id: chapter.id,
      content: chapterBody.content,
    });

    const persisted = await prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      select: { status: true, chapterCount: true, publishedAt: true },
    });
    expect(persisted.status).toBe(StoryStatus.PUBLISHED);
    expect(persisted.chapterCount).toBe(1);
    expect(persisted.publishedAt).not.toBeNull();

    const persistedChapter = await prisma.chapter.findUniqueOrThrow({
      where: { id: chapter.id },
      select: { status: true, publishedAt: true },
    });
    expect(persistedChapter.status).toBe(ChapterStatus.PUBLISHED);
    expect(persistedChapter.publishedAt).not.toBeNull();

    const readerToken = token(intruderId, intruderSessionId);
    const libraryResponse = await request(httpServer())
      .put(`/api/v1/library/${storyId}`)
      .set('Authorization', `Bearer ${readerToken}`)
      .send({ isFavorite: true })
      .expect(200);
    expect(
      unwrap<{ isFavorite: boolean }>(libraryResponse.body as unknown)
        .isFavorite,
    ).toBe(true);

    await request(httpServer())
      .put(`/api/v1/reading-progress/${storyId}`)
      .set('Authorization', `Bearer ${readerToken}`)
      .send({ chapterId: chapter.id, position: 0 })
      .expect(200);

    const historyResponse = await request(httpServer())
      .get('/api/v1/reading-history')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);
    expect(
      unwrap<Array<{ story: { id: string } }>>(historyResponse.body as unknown),
    ).toEqual([
      expect.objectContaining({
        story: expect.objectContaining({ id: storyId }) as unknown,
      }),
    ]);

    const secondDeviceToken = token(intruderId, intruderSecondSessionId);

    const bookmarkResponse = await request(httpServer())
      .put(`/api/v1/reading-bookmarks/${chapter.id}`)
      .set('Authorization', `Bearer ${readerToken}`)
      .send({})
      .expect(200);
    expect(
      unwrap<{ chapterId: string; storyId: string }>(
        bookmarkResponse.body as unknown,
      ),
    ).toMatchObject({ chapterId: chapter.id, storyId });

    const bookmarkFromSecondDevice = await request(httpServer())
      .get(`/api/v1/reading-bookmarks/${chapter.id}`)
      .set('Authorization', `Bearer ${secondDeviceToken}`)
      .expect(200);
    expect(
      unwrap<{ chapterId: string } | null>(
        bookmarkFromSecondDevice.body as unknown,
      ),
    ).toMatchObject({ chapterId: chapter.id });

    const bookmarkListFromSecondDevice = await request(httpServer())
      .get('/api/v1/reading-bookmarks')
      .set('Authorization', `Bearer ${secondDeviceToken}`)
      .expect(200);
    expect(
      unwrap<Array<{ chapterId: string }>>(
        bookmarkListFromSecondDevice.body as unknown,
      ),
    ).toEqual([expect.objectContaining({ chapterId: chapter.id })]);

    await request(httpServer())
      .delete(`/api/v1/reading-bookmarks/${chapter.id}`)
      .set('Authorization', `Bearer ${secondDeviceToken}`)
      .expect(204);

    const bookmarkAfterRemoteDelete = await request(httpServer())
      .get(`/api/v1/reading-bookmarks/${chapter.id}`)
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);
    expect(
      unwrap<unknown>(bookmarkAfterRemoteDelete.body as unknown),
    ).toBeNull();

    await request(httpServer())
      .put(`/api/v1/stories/${storyId}/rating`)
      .set('Authorization', `Bearer ${readerToken}`)
      .send({ score: 5 })
      .expect(200);
    const ratingResponse = await request(httpServer())
      .get(`/api/v1/stories/${storyId}/rating/me`)
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);
    expect(
      unwrap<{ score: number }>(ratingResponse.body as unknown).score,
    ).toBe(5);

    const commentKey = `reader-comment-${runId}`;
    const commentResponse = await request(httpServer())
      .post(`/api/v1/stories/${storyId}/comments`)
      .set('Authorization', `Bearer ${readerToken}`)
      .set('x-idempotency-key', commentKey)
      .send({ body: 'M10 reader comment' })
      .expect(201);
    const comment = unwrap<{ id: string; body: string }>(
      commentResponse.body as unknown,
    );
    expect(comment.body).toBe('M10 reader comment');

    const replayCommentResponse = await request(httpServer())
      .post(`/api/v1/stories/${storyId}/comments`)
      .set('Authorization', `Bearer ${readerToken}`)
      .set('x-idempotency-key', commentKey)
      .send({ body: 'M10 reader comment' })
      .expect(201);
    expect(replayCommentResponse.headers['x-idempotent-replayed']).toBe('true');
    expect(
      unwrap<{ id: string }>(replayCommentResponse.body as unknown).id,
    ).toBe(comment.id);
    await expect(
      prisma.comment.count({
        where: { storyId, userId: intruderId, deletedAt: null },
      }),
    ).resolves.toBe(1);

    await request(httpServer())
      .patch(`/api/v1/comments/${comment.id}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ body: 'Story owner must not edit another reader comment' })
      .expect(404);

    await request(httpServer())
      .patch(`/api/v1/comments/${comment.id}`)
      .set('Authorization', `Bearer ${readerToken}`)
      .send({ body: 'M10 edited reader comment' })
      .expect(200);

    const commentsResponse = await request(httpServer())
      .get(`/api/v1/stories/${createdStory.slug}/comments`)
      .expect(200);
    expect(
      unwrap<{ items: Array<{ id: string; body: string }> }>(
        commentsResponse.body as unknown,
      ).items,
    ).toEqual([
      expect.objectContaining({
        id: comment.id,
        body: 'M10 edited reader comment',
      }),
    ]);

    await request(httpServer())
      .delete(`/api/v1/comments/${comment.id}`)
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(204);

    const commentsAfterDelete = await request(httpServer())
      .get(`/api/v1/stories/${createdStory.slug}/comments`)
      .expect(200);
    expect(
      unwrap<{ items: Array<{ id: string }> }>(
        commentsAfterDelete.body as unknown,
      ).items,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: comment.id })]),
    );

    const chapterCommentResponse = await request(httpServer())
      .post(`/api/v1/stories/${storyId}/chapters/${chapter.id}/comments`)
      .set('Authorization', `Bearer ${readerToken}`)
      .set('x-idempotency-key', `reader-chapter-comment-${runId}`)
      .send({ body: 'M10 chapter comment' })
      .expect(201);
    const chapterComment = unwrap<{ id: string; chapterId: string | null }>(
      chapterCommentResponse.body as unknown,
    );
    expect(chapterComment.chapterId).toBe(chapter.id);

    const chapterCommentsResponse = await request(httpServer())
      .get(`/api/v1/stories/${createdStory.slug}/chapters/1/comments`)
      .expect(200);
    expect(
      unwrap<{ items: Array<{ id: string }> }>(
        chapterCommentsResponse.body as unknown,
      ).items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: chapterComment.id }),
      ]),
    );
  });

  it('suspend author blocks writes immediately while published content remains public', async () => {
    if (!storyId)
      throw new Error('Workflow story must exist before lifecycle test');

    const adminToken = token(adminId, adminSessionId);
    const authorToken = token(authorId, authorSessionId);
    const publicStory = await prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      select: { slug: true },
    });

    await request(httpServer())
      .patch(`/api/v1/admin/authors/${authorId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'SUSPENDED',
        reason: 'E2E lifecycle suspension for write protection',
      })
      .expect(200);

    await request(httpServer())
      .post('/api/v1/author/stories')
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', `suspended-author-create-${runId}`)
      .send({ title: 'Suspended author cannot create' })
      .expect(403);

    await request(httpServer())
      .get(`/api/v1/stories/${publicStory.slug}`)
      .expect(200);

    await request(httpServer())
      .patch(`/api/v1/admin/authors/${authorId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    await request(httpServer())
      .post('/api/v1/author/stories')
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-idempotency-key', `reactivated-author-create-${runId}`)
      .send({ title: `Reactivated ${compactRunId.slice(0, 8)}` })
      .expect(201);
  });

  it('create endpoints reject requests without an idempotency key', async () => {
    const authorToken = token(authorId, authorSessionId);

    await request(httpServer())
      .post('/api/v1/author/stories')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Missing idempotency key' })
      .expect(400);
  });

  function httpServer(): Parameters<typeof request>[0] {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  function token(userId: string, sessionId: string): string {
    return jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        typ: JwtTokenType.ACCESS,
        ver: 0,
      },
      ACCESS_SECRET,
      {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        expiresIn: '5m',
        jwtid: randomUUID(),
      },
    );
  }

  function unwrap<T>(body: unknown): T {
    if (!body || typeof body !== 'object' || !('data' in body)) {
      throw new Error('Expected API success envelope');
    }

    return (body as { data: T }).data;
  }

  async function seedAuthorization(): Promise<void> {
    const permissionCodes = [...AUTHOR_PERMISSIONS, ...ADMIN_PERMISSIONS];
    const permissions = await Promise.all(
      permissionCodes.map((code) =>
        prisma.permission.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name: `E2E ${code}`,
            resource: code.split('.')[0] ?? 'stories',
            action: code.split('.').slice(1).join('.') || 'use',
          },
          select: { id: true, code: true },
        }),
      ),
    );

    const [authorRole, adminRole] = await Promise.all([
      prisma.role.upsert({
        where: { code: RoleCode.AUTHOR },
        update: {},
        create: {
          code: RoleCode.AUTHOR,
          name: 'Author',
          isSystem: true,
        },
      }),
      prisma.role.upsert({
        where: { code: RoleCode.ADMIN },
        update: {},
        create: {
          code: RoleCode.ADMIN,
          name: 'Admin',
          isSystem: true,
        },
      }),
    ]);

    const permissionIdByCode = new Map<string, string>(
      permissions.map((permission) => [permission.code, permission.id]),
    );

    await prisma.rolePermission.createMany({
      data: [
        ...AUTHOR_PERMISSIONS.map((code) => ({
          roleId: authorRole.id,
          permissionId: requiredPermissionId(permissionIdByCode, code),
        })),
        ...ADMIN_PERMISSIONS.map((code) => ({
          roleId: adminRole.id,
          permissionId: requiredPermissionId(permissionIdByCode, code),
        })),
      ],
      skipDuplicates: true,
    });

    await prisma.user.createMany({
      data: [
        actorRow(authorId, 'author'),
        actorRow(intruderId, 'intruder'),
        actorRow(adminId, 'admin'),
      ],
    });

    await prisma.authorProfile.createMany({
      data: [
        {
          userId: authorId,
          penName: `Workflow Pen ${compactRunId.slice(0, 8)}`,
          slug: `workflow-pen-${compactRunId.slice(0, 12)}`,
        },
        {
          userId: intruderId,
          penName: `Workflow Intruder ${compactRunId.slice(0, 8)}`,
          slug: `workflow-intruder-${compactRunId.slice(0, 12)}`,
        },
      ],
    });

    await prisma.userRole.createMany({
      data: [
        { userId: authorId, roleId: authorRole.id },
        { userId: intruderId, roleId: authorRole.id },
        { userId: adminId, roleId: adminRole.id },
      ],
    });

    await prisma.session.createMany({
      data: [
        sessionRow(authorId, authorSessionId),
        sessionRow(intruderId, intruderSessionId),
        sessionRow(intruderId, intruderSecondSessionId),
        sessionRow(adminId, adminSessionId),
      ],
    });

    const category = await prisma.category.create({
      data: {
        name: `Workflow E2E ${compactRunId.slice(0, 8)}`,
        slug: `workflow-e2e-${compactRunId.slice(0, 12)}`,
        isActive: true,
      },
      select: { id: true },
    });
    categoryId = category.id;
  }

  function actorRow(id: string, label: string) {
    return {
      id,
      email: `stories-workflow-${label}-${runId}@example.test`,
      username: `stories_${label}_${compactRunId.slice(0, 16)}`,
      passwordHash: 'stories-workflow-e2e-password-hash',
      displayName: `Stories Workflow ${label}`,
      emailVerifiedAt: new Date(),
    };
  }

  function sessionRow(userId: string, id: string) {
    return {
      id,
      userId,
      refreshTokenHash: `stories-workflow-refresh-${id}`,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    };
  }

  async function createReadyCover(ownerStoryId: string): Promise<string> {
    const media = await prisma.mediaAsset.create({
      data: {
        uploaderId: authorId,
        purpose: MediaPurpose.STORY_COVER,
        status: MediaStatus.READY,
        resourceType: MediaResourceType.IMAGE,
        storageProvider: 'e2e',
        publicId: `workflow-cover-${compactRunId}`,
        secureUrl: 'https://example.test/workflow-cover.webp',
        metadata: { ownerId: ownerStoryId },
        readyAt: new Date(),
      },
      select: { id: true },
    });

    return media.id;
  }

  async function cleanupRun(): Promise<void> {
    const actorIds = [authorId, intruderId, adminId];

    await prisma.auditLog.deleteMany({
      where: { actorId: { in: actorIds } },
    });
    await prisma.moderationAction.deleteMany({
      where: { actorId: { in: actorIds } },
    });
    await prisma.story.deleteMany({ where: { authorId } });
    await prisma.mediaAsset.deleteMany({ where: { uploaderId: authorId } });
    await prisma.authorProfile.deleteMany({
      where: { userId: { in: [authorId, intruderId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
  }
});

function requiredPermissionId(
  permissionIdByCode: ReadonlyMap<string, string>,
  code: PermissionCode,
): string {
  const id = permissionIdByCode.get(code);
  if (!id) throw new Error(`Missing permission row for ${code}`);
  return id;
}
