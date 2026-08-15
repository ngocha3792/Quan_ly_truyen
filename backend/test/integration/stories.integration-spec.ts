import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import {
  ChapterStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  StoryStatus,
  StoryVisibility,
  SubmissionStatus,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import {
  PrismaChapterPersistence,
  PrismaStoryPersistence,
} from '@/modules/stories/infrastructure';

describe('Stories PostgreSQL race and ownership invariants', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let stories: PrismaStoryPersistence;
  let chapters: PrismaChapterPersistence;

  const runId = randomUUID();
  const compactRunId = runId.replaceAll('-', '');
  let sequence = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [PrismaStoryPersistence, PrismaChapterPersistence],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    stories = moduleRef.get(PrismaStoryPersistence);
    chapters = moduleRef.get(PrismaChapterPersistence);
  });

  afterEach(async () => {
    await cleanupRun();
  });

  afterAll(async () => {
    await cleanupRun();
    await moduleRef.close();
  });

  it('serialize concurrent chapter creation so chapter numbers remain unique', async () => {
    const author = await createAuthor('chapter-race');
    const story = await createStory(author.id, StoryStatus.DRAFT);
    const createdAt = new Date();

    const results = await Promise.all([
      chapters.createDraft({
        userId: author.id,
        storyId: story.id,
        title: 'Concurrent A',
        content: 'Nội dung A',
        wordCount: 3,
        createdAt,
        audit: audit('chapter-race-a'),
      }),
      chapters.createDraft({
        userId: author.id,
        storyId: story.id,
        title: 'Concurrent B',
        content: 'Nội dung B',
        wordCount: 3,
        createdAt,
        audit: audit('chapter-race-b'),
      }),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'created',
      'created',
    ]);

    const persisted = await prisma.chapter.findMany({
      where: { storyId: story.id },
      orderBy: { number: 'asc' },
      select: { number: true },
    });

    expect(persisted.map(({ number }) => number.toNumber())).toEqual([1, 2]);
  });

  it('publish concurrent chỉ transition một lần và chỉ increment chapterCount một lần', async () => {
    const author = await createAuthor('publish-race');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const chapter = await createChapter(author.id, story.id, 1);
    const publishedAt = new Date();

    const results = await Promise.all([
      chapters.publish({
        userId: author.id,
        storyId: story.id,
        chapterId: chapter.id,
        publishedAt,
        audit: audit('publish-race-a'),
      }),
      chapters.publish({
        userId: author.id,
        storyId: story.id,
        chapterId: chapter.id,
        publishedAt,
        audit: audit('publish-race-b'),
      }),
    ]);

    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual(['not_draft', 'published']);

    const [freshStory, freshChapter, publishAudits] = await Promise.all([
      prisma.story.findUniqueOrThrow({
        where: { id: story.id },
        select: { chapterCount: true },
      }),
      prisma.chapter.findUniqueOrThrow({
        where: { id: chapter.id },
        select: { status: true, publishedAt: true },
      }),
      prisma.auditLog.count({
        where: {
          entityId: chapter.id,
          action: 'chapter.published',
        },
      }),
    ]);

    expect(freshStory.chapterCount).toBe(1);
    expect(freshChapter.status).toBe(ChapterStatus.PUBLISHED);
    expect(freshChapter.publishedAt).not.toBeNull();
    expect(publishAudits).toBe(1);
  });

  it('cancel-vs-approve concurrent chỉ cho phép đúng một terminal transition thắng', async () => {
    const author = await createAuthor('review-race-author');
    const reviewer = await createUser('review-race-reviewer');
    const ready = await createReviewReadyDraft(author.id);

    const submitted = await stories.submitForReview({
      userId: author.id,
      storyId: ready.storyId,
      authorNote: 'Ready for review',
      submittedAt: new Date(),
      audit: audit('submit-before-race'),
    });

    expect(submitted.status).toBe('submitted');
    if (submitted.status !== 'submitted') return;

    const submissionId = submitted.publication.submission.id;
    const transitionedAt = new Date();

    const [cancelResult, approveResult] = await Promise.all([
      stories.cancelSubmission({
        userId: author.id,
        storyId: ready.storyId,
        canceledAt: transitionedAt,
        audit: audit('cancel-race'),
      }),
      stories.approveSubmission({
        reviewerId: reviewer.id,
        submissionId,
        reviewedAt: transitionedAt,
        audit: audit('approve-race'),
      }),
    ]);

    const terminalStatuses = [cancelResult.status, approveResult.status];
    expect(
      terminalStatuses.filter(
        (status) => status === 'canceled' || status === 'approved',
      ),
    ).toHaveLength(1);
    expect(
      terminalStatuses.filter((status) => status === 'not_pending'),
    ).toHaveLength(1);

    const [freshStory, freshSubmission] = await Promise.all([
      prisma.story.findUniqueOrThrow({
        where: { id: ready.storyId },
        select: { status: true, visibility: true },
      }),
      prisma.storySubmission.findUniqueOrThrow({
        where: { id: submissionId },
        select: { status: true },
      }),
    ]);

    if (freshSubmission.status === SubmissionStatus.APPROVED) {
      expect(freshStory).toMatchObject({
        status: StoryStatus.PUBLISHED,
        visibility: StoryVisibility.PUBLIC,
      });
    } else {
      expect(freshSubmission.status).toBe(SubmissionStatus.CANCELED);
      expect(freshStory).toMatchObject({
        status: StoryStatus.DRAFT,
        visibility: StoryVisibility.PRIVATE,
      });
    }
  });

  it('không leak hoặc mutate story/chapter của author khác', async () => {
    const owner = await createAuthor('ownership-owner');
    const intruder = await createAuthor('ownership-intruder');
    const story = await createStory(owner.id, StoryStatus.DRAFT);
    const chapter = await createChapter(owner.id, story.id, 1);

    await expect(
      stories.findOwnedById(intruder.id, story.id),
    ).resolves.toBeNull();
    await expect(
      chapters.listOwnedByStory(intruder.id, story.id),
    ).resolves.toBeNull();
    await expect(
      chapters.findOwnedById(intruder.id, story.id, chapter.id),
    ).resolves.toBeNull();

    const storyUpdate = await stories.updateDraft({
      userId: intruder.id,
      storyId: story.id,
      title: 'Stolen title',
      updatedAt: new Date(),
      audit: audit('intruder-story-update'),
    });
    const chapterUpdate = await chapters.updateDraft({
      userId: intruder.id,
      storyId: story.id,
      chapterId: chapter.id,
      title: 'Stolen chapter',
      updatedAt: new Date(),
      audit: audit('intruder-chapter-update'),
    });

    expect(storyUpdate.status).toBe('not_found');
    expect(chapterUpdate.status).toBe('not_found');

    const [freshStory, freshChapter] = await Promise.all([
      prisma.story.findUniqueOrThrow({
        where: { id: story.id },
        select: { title: true },
      }),
      prisma.chapter.findUniqueOrThrow({
        where: { id: chapter.id },
        select: { title: true },
      }),
    ]);

    expect(freshStory.title).not.toBe('Stolen title');
    expect(freshChapter.title).not.toBe('Stolen chapter');
  });

  it('public read model fail-closed khi PUBLISHED/PUBLIC record thiếu publishedAt', async () => {
    const author = await createAuthor('public-invariant');
    const inconsistent = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: null,
    });
    await createChapter(author.id, inconsistent.id, 1, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    const page = await stories.listPublic({
      sort: 'latest',
      page: 1,
      pageSize: 20,
    });

    expect(page.items.some((item) => item.id === inconsistent.id)).toBe(false);
    await expect(
      stories.findPublicBySlug(inconsistent.slug),
    ).resolves.toBeNull();
    await expect(
      chapters.findPublicReader(inconsistent.slug, '1'),
    ).resolves.toBeNull();
  });

  async function createReviewReadyDraft(
    userId: string,
  ): Promise<{ storyId: string }> {
    const story = await createStory(userId, StoryStatus.DRAFT, {
      synopsis: 'Đủ dữ liệu để gửi duyệt.',
    });
    const category = await prisma.category.create({
      data: {
        name: unique('Category'),
        slug: unique('category'),
        isActive: true,
      },
    });
    await prisma.storyCategory.create({
      data: {
        storyId: story.id,
        categoryId: category.id,
        isPrimary: true,
      },
    });
    const cover = await prisma.mediaAsset.create({
      data: {
        uploaderId: userId,
        purpose: MediaPurpose.STORY_COVER,
        status: MediaStatus.READY,
        resourceType: MediaResourceType.IMAGE,
        storageProvider: 'integration-test',
        publicId: unique('cover'),
        secureUrl: 'https://example.test/cover.webp',
        metadata: { ownerId: story.id },
        readyAt: new Date(),
      },
    });
    await prisma.story.update({
      where: { id: story.id },
      data: { coverMediaId: cover.id },
    });
    await createChapter(userId, story.id, 1, {
      content: 'Nội dung hợp lệ.',
    });

    return { storyId: story.id };
  }

  async function createAuthor(label: string): Promise<{ id: string }> {
    const user = await createUser(label);
    await prisma.authorProfile.create({
      data: {
        userId: user.id,
        penName: unique(`Pen ${label}`),
        slug: unique(`pen-${label}`),
      },
    });
    return user;
  }

  async function createUser(label: string): Promise<{ id: string }> {
    sequence += 1;
    return prisma.user.create({
      data: {
        email: `${label}.${sequence}.${runId}@example.test`,
        username: unique(`${label}-${sequence}`).slice(0, 50),
        passwordHash: 'stories-integration-password-hash',
        displayName: `Stories ${label}`,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
  }

  async function createStory(
    authorId: string,
    status: StoryStatus,
    overrides: {
      visibility?: StoryVisibility;
      publishedAt?: Date | null;
      synopsis?: string;
    } = {},
  ) {
    return prisma.story.create({
      data: {
        authorId,
        title: unique('Story'),
        slug: unique('story'),
        synopsis: overrides.synopsis ?? 'Integration story synopsis.',
        status,
        visibility: overrides.visibility ?? StoryVisibility.PRIVATE,
        publishedAt: overrides.publishedAt,
      },
    });
  }

  async function createChapter(
    userId: string,
    storyId: string,
    number: number,
    overrides: {
      status?: ChapterStatus;
      publishedAt?: Date | null;
      content?: string;
    } = {},
  ) {
    return prisma.chapter.create({
      data: {
        storyId,
        createdById: userId,
        updatedById: userId,
        number,
        title: `Chapter ${number}`,
        slug: `chapter-${number}-${compactRunId.slice(0, 8)}`,
        content: overrides.content ?? 'Draft content',
        status: overrides.status ?? ChapterStatus.DRAFT,
        wordCount: 2,
        publishedAt: overrides.publishedAt,
      },
    });
  }

  function audit(label: string) {
    return {
      requestId: `${label}-${runId}`,
      ipAddress: '127.0.0.1',
      userAgent: 'Jest stories integration',
    };
  }

  function unique(prefix: string): string {
    sequence += 1;
    return `${prefix}-${compactRunId.slice(0, 10)}-${sequence}`.toLowerCase();
  }

  async function cleanupRun(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { contains: runId } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);

    if (userIds.length === 0) return;

    await prisma.auditLog.deleteMany({
      where: { actorId: { in: userIds } },
    });
    await prisma.moderationAction.deleteMany({
      where: { actorId: { in: userIds } },
    });
    await prisma.story.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.mediaAsset.deleteMany({
      where: { uploaderId: { in: userIds } },
    });
    await prisma.authorProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({
      where: { slug: { contains: compactRunId.slice(0, 10) } },
    });
  }
});
