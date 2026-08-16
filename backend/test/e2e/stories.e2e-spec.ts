import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { configureApplication } from '@/bootstrap';
import type { AppConfig } from '@/config';
import {
  ChapterStatus,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

describe('Stories public HTTP E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = randomUUID();
  const compactRunId = runId.replaceAll('-', '');
  let authorId: string;
  let publicStoryId: string;
  let publicSlug: string;
  let inconsistentSlug: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
    configureApplication(app, appConfig);
    await app.init();

    prisma = app.get(PrismaService);
    await seedRun();
  });

  afterAll(async () => {
    await cleanupRun();
    await app.close();
  });

  const httpServer = () => app.getHttpServer() as Parameters<typeof request>[0];

  it('list/detail chỉ expose story thật sự đã published', async () => {
    const listResponse = await request(httpServer())
      .get('/api/v1/stories')
      .query({ q: `E2E ${compactRunId.slice(0, 8)}` })
      .expect(200);

    const page = unwrap<{
      items: Array<{ id: string; slug: string }>;
    }>(listResponse.body as unknown);

    expect(page.items).toEqual([
      expect.objectContaining({ id: publicStoryId, slug: publicSlug }),
    ]);

    const detailResponse = await request(httpServer())
      .get(`/api/v1/stories/${publicSlug}`)
      .expect(200);

    expect(
      unwrap<{
        id: string;
        latestChapter: { number: number } | null;
      }>(detailResponse.body as unknown),
    ).toMatchObject({
      id: publicStoryId,
      latestChapter: { number: 2 },
    });

    await request(httpServer())
      .get(`/api/v1/stories/${inconsistentSlug}`)
      .expect(404);
  });

  it('chapter reader chỉ expose published chapter và navigation bỏ qua draft/deleted', async () => {
    const response = await request(httpServer())
      .get(`/api/v1/stories/${publicSlug}/chapters/1`)
      .expect(200);

    const reader = unwrap<{
      chapter: { number: number; content: string };
      navigation: {
        previous: { number: number } | null;
        next: { number: number } | null;
      };
    }>(response.body as unknown);

    expect(reader.chapter).toMatchObject({
      number: 1,
      content: 'E2E first published chapter.',
    });
    expect(reader.navigation.previous).toBeNull();
    expect(reader.navigation.next).toMatchObject({ number: 2 });

    await request(httpServer())
      .get(`/api/v1/stories/${publicSlug}/chapters/3`)
      .expect(404);
    await request(httpServer())
      .get(`/api/v1/stories/${publicSlug}/chapters/4`)
      .expect(404);
  });

  it('chapter number malformed bị validation chặn trước persistence', async () => {
    await request(httpServer())
      .get(`/api/v1/stories/${publicSlug}/chapters/1.234`)
      .expect(400);
  });

  async function seedRun(): Promise<void> {
    const user = await prisma.user.create({
      data: {
        email: `stories.e2e.${runId}@example.test`,
        username: `stories_e2e_${compactRunId.slice(0, 12)}`,
        passwordHash: 'stories-e2e-password-hash',
        displayName: 'Stories E2E Author',
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    authorId = user.id;

    await prisma.authorProfile.create({
      data: {
        userId: authorId,
        penName: `E2E Pen ${compactRunId.slice(0, 8)}`,
        slug: `e2e-pen-${compactRunId.slice(0, 12)}`,
      },
    });

    const now = new Date();
    publicSlug = `e2e-public-${compactRunId.slice(0, 12)}`;
    inconsistentSlug = `e2e-inconsistent-${compactRunId.slice(0, 12)}`;

    const publicStory = await prisma.story.create({
      data: {
        authorId,
        title: `E2E ${compactRunId.slice(0, 8)} Public Story`,
        slug: publicSlug,
        synopsis: 'Public story used by HTTP E2E.',
        status: StoryStatus.PUBLISHED,
        visibility: StoryVisibility.PUBLIC,
        publishedAt: now,
        chapterCount: 2,
        lastChapterAt: now,
      },
      select: { id: true },
    });
    publicStoryId = publicStory.id;

    await prisma.story.create({
      data: {
        authorId,
        title: `E2E ${compactRunId.slice(0, 8)} Inconsistent Story`,
        slug: inconsistentSlug,
        synopsis: 'Must fail closed because publishedAt is null.',
        status: StoryStatus.PUBLISHED,
        visibility: StoryVisibility.PUBLIC,
        publishedAt: null,
      },
    });

    await prisma.chapter.createMany({
      data: [
        {
          storyId: publicStoryId,
          createdById: authorId,
          updatedById: authorId,
          number: 1,
          title: 'E2E Chapter One',
          slug: 'chapter-1',
          content: 'E2E first published chapter.',
          status: ChapterStatus.PUBLISHED,
          wordCount: 4,
          publishedAt: now,
        },
        {
          storyId: publicStoryId,
          createdById: authorId,
          updatedById: authorId,
          number: 2,
          title: 'E2E Chapter Two',
          slug: 'chapter-2',
          content: 'E2E second published chapter.',
          status: ChapterStatus.PUBLISHED,
          wordCount: 4,
          publishedAt: now,
        },
        {
          storyId: publicStoryId,
          createdById: authorId,
          updatedById: authorId,
          number: 3,
          title: 'E2E Draft Chapter',
          slug: 'chapter-3',
          content: 'This draft must stay private.',
          status: ChapterStatus.DRAFT,
          wordCount: 5,
        },
        {
          storyId: publicStoryId,
          createdById: authorId,
          updatedById: authorId,
          number: 4,
          title: 'E2E Deleted Published Chapter',
          slug: 'chapter-4',
          content: 'Deleted content must stay private.',
          status: ChapterStatus.PUBLISHED,
          wordCount: 5,
          publishedAt: now,
          deletedAt: now,
        },
      ],
    });
  }

  async function cleanupRun(): Promise<void> {
    if (!authorId) return;
    await prisma.story.deleteMany({ where: { authorId } });
    await prisma.authorProfile.deleteMany({ where: { userId: authorId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
  }
});

function unwrap<T>(body: unknown): T {
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new Error('Expected API success envelope');
  }

  return (body as { data: T }).data;
}
