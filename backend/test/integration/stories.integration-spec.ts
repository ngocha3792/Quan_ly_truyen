import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import {
  ChapterStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  ModerationStatus,
  StoryStatus,
  StoryVisibility,
  SubmissionStatus,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PrismaLibraryPersistence } from '@/modules/libraries/infrastructure';
import { PrismaRatingPersistence } from '@/modules/ratings/infrastructure';
import { PrismaReadingHistoryPersistence } from '@/modules/reading-history/infrastructure';
import { PrismaChapterPersistence } from '@/modules/chapters/infrastructure';
import { PrismaCommentPersistence } from '@/modules/comments/infrastructure';
import { MEDIA_URL_BUILDER } from '@/modules/media';
import { PrismaStoryPersistence } from '@/modules/stories/infrastructure';
import { PrismaChapterWorkflowPersistence } from '@/modules/chapters/infrastructure/persistence/prisma-chapter-workflow.persistence';
import { PrismaChapterEditSessionPersistence } from '@/modules/chapters/infrastructure/persistence/prisma-chapter-edit-session.persistence';

describe('Stories PostgreSQL race and ownership invariants', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let stories: PrismaStoryPersistence;
  let chapters: PrismaChapterPersistence;
  let engagement: PrismaCommentPersistence;
  let libraries: PrismaLibraryPersistence;
  let ratings: PrismaRatingPersistence;
  let readingHistory: PrismaReadingHistoryPersistence;

  const runId = randomUUID();
  const compactRunId = runId.replaceAll('-', '');
  let sequence = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaStoryPersistence,
        PrismaChapterWorkflowPersistence,
        PrismaChapterEditSessionPersistence,
        PrismaChapterPersistence,
        PrismaCommentPersistence,
        PrismaLibraryPersistence,
        PrismaRatingPersistence,
        PrismaReadingHistoryPersistence,
        {
          provide: MEDIA_URL_BUILDER,
          useValue: {
            build: jest.fn(() => 'https://media.test/chapter-image'),
          },
        },
      ],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    stories = moduleRef.get(PrismaStoryPersistence);
    chapters = moduleRef.get(PrismaChapterPersistence);
    engagement = moduleRef.get(PrismaCommentPersistence);
    libraries = moduleRef.get(PrismaLibraryPersistence);
    ratings = moduleRef.get(PrismaRatingPersistence);
    readingHistory = moduleRef.get(PrismaReadingHistoryPersistence);
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
    const chapter = await createChapter(author.id, story.id, 1, {
      status: ChapterStatus.APPROVED,
    });
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

  it('schedule, reschedule, cancel và worker publish chỉ transition một lần', async () => {
    const author = await createAuthor('chapter-schedule');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const chapter = await createChapter(author.id, story.id, 1, {
      status: ChapterStatus.APPROVED,
    });
    const firstSchedule = new Date(Date.now() + 120_000);
    const secondSchedule = new Date(Date.now() + 240_000);

    const first = await chapters.schedule({
      userId: author.id,
      storyId: story.id,
      chapterId: chapter.id,
      scheduledAt: firstSchedule,
      updatedAt: new Date(),
      audit: audit('schedule-first'),
    });
    expect(first.status).toBe('scheduled');

    const rescheduled = await chapters.schedule({
      userId: author.id,
      storyId: story.id,
      chapterId: chapter.id,
      scheduledAt: secondSchedule,
      updatedAt: new Date(),
      audit: audit('schedule-second'),
    });
    expect(rescheduled.status).toBe('scheduled');

    const canceled = await chapters.cancelSchedule({
      userId: author.id,
      storyId: story.id,
      chapterId: chapter.id,
      canceledAt: new Date(),
      audit: audit('schedule-cancel'),
    });
    expect(canceled.status).toBe('canceled');
    if (canceled.status === 'canceled')
      expect(canceled.chapter.status).toBe('APPROVED');

    const dueAt = new Date(Date.now() - 1000);
    await chapters.schedule({
      userId: author.id,
      storyId: story.id,
      chapterId: chapter.id,
      scheduledAt: dueAt,
      updatedAt: dueAt,
      audit: audit('schedule-due'),
    });

    const requestId = `scheduled-worker-${runId}`;
    const firstBatch = await chapters.publishDueScheduled({
      dueAt: new Date(),
      batchSize: 25,
      requestId,
    });
    const replayBatch = await chapters.publishDueScheduled({
      dueAt: new Date(),
      batchSize: 25,
      requestId,
    });

    expect(firstBatch).toBe(1);
    expect(replayBatch).toBe(0);

    const [freshStory, freshChapter, outboxCount] = await Promise.all([
      prisma.story.findUniqueOrThrow({
        where: { id: story.id },
        select: { chapterCount: true },
      }),
      prisma.chapter.findUniqueOrThrow({
        where: { id: chapter.id },
        select: { status: true, scheduledAt: true, publishedAt: true },
      }),
      prisma.outboxEvent.count({
        where: {
          aggregateId: chapter.id,
          eventType: {
            in: [
              'notification.author-chapter-published.v1',
              'ai.auto-translate-chapter-published.v1',
            ],
          },
        },
      }),
    ]);

    expect(freshStory.chapterCount).toBe(1);
    expect(freshChapter).toMatchObject({
      status: ChapterStatus.PUBLISHED,
      scheduledAt: null,
    });
    expect(freshChapter.publishedAt).not.toBeNull();
    expect(outboxCount).toBe(2);
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

  it('approve-vs-reject concurrent chỉ cho phép đúng một reviewer thắng', async () => {
    const author = await createAuthor('moderation-race-author');
    const approveReviewer = await createUser('moderation-race-approve');
    const rejectReviewer = await createUser('moderation-race-reject');
    const ready = await createReviewReadyDraft(author.id);

    const submitted = await stories.submitForReview({
      userId: author.id,
      storyId: ready.storyId,
      authorNote: 'Ready for approve/reject race',
      submittedAt: new Date(),
      audit: audit('moderation-race-submit'),
    });

    expect(submitted.status).toBe('submitted');
    if (submitted.status !== 'submitted') return;

    const submissionId = submitted.publication.submission.id;
    const reviewedAt = new Date();
    const [approveResult, rejectResult] = await Promise.all([
      stories.approveSubmission({
        reviewerId: approveReviewer.id,
        submissionId,
        reviewedAt,
        audit: audit('moderation-race-approve'),
      }),
      stories.rejectSubmission({
        reviewerId: rejectReviewer.id,
        submissionId,
        reviewerNote: 'Rejected by concurrent reviewer',
        reviewedAt,
        audit: audit('moderation-race-reject'),
      }),
    ]);

    const statuses = [approveResult.status, rejectResult.status];
    expect(
      statuses.filter(
        (status) => status === 'approved' || status === 'rejected',
      ),
    ).toHaveLength(1);
    expect(statuses.filter((status) => status === 'not_pending')).toHaveLength(
      1,
    );

    const [submission, auditCount, moderationCount] = await Promise.all([
      prisma.storySubmission.findUniqueOrThrow({
        where: { id: submissionId },
        select: { status: true },
      }),
      prisma.auditLog.count({
        where: {
          entityType: 'story',
          entityId: ready.storyId,
          action: {
            in: ['STORY_SUBMISSION_APPROVED', 'STORY_SUBMISSION_REJECTED'],
          },
        },
      }),
      prisma.moderationAction.count({ where: { submissionId } }),
    ]);

    expect([SubmissionStatus.APPROVED, SubmissionStatus.REJECTED]).toContain(
      submission.status,
    );
    expect(auditCount).toBe(1);
    expect(moderationCount).toBe(1);
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
      chapters.findPublicReader(inconsistent.slug, '1', undefined, true),
    ).resolves.toBeNull();
  });

  it('reader engagement giữ unique/counter/ownership invariants dưới concurrent writes', async () => {
    const author = await createAuthor('engagement-author');
    const reader = await createUser('engagement-reader');
    const secondReader = await createUser('engagement-reader-2');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const chapter = await createChapter(author.id, story.id, 1, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
      content: 'Public chapter for engagement.',
    });
    const nextChapter = await createChapter(author.id, story.id, 2, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
      content: 'Second public chapter for progress races.',
    });

    const libraryResults = await Promise.all([
      libraries.upsert({
        userId: reader.id,
        storyId: story.id,
        isFavorite: true,
        updatedAt: new Date(),
      }),
      libraries.upsert({
        userId: reader.id,
        storyId: story.id,
        isFavorite: true,
        updatedAt: new Date(),
      }),
    ]);
    expect(libraryResults.every((result) => result.status === 'updated')).toBe(
      true,
    );
    await expect(
      prisma.libraryEntry.count({
        where: { userId: reader.id, storyId: story.id },
      }),
    ).resolves.toBe(1);

    const olderReadAt = new Date(Date.now() - 1_000);
    const newerReadAt = new Date();
    const progressResults = await Promise.all([
      readingHistory.saveProgress({
        userId: reader.id,
        storyId: story.id,
        chapterId: chapter.id,
        position: 0,
        readAt: olderReadAt,
      }),
      readingHistory.saveProgress({
        userId: reader.id,
        storyId: story.id,
        chapterId: nextChapter.id,
        position: 200,
        readAt: newerReadAt,
      }),
    ]);
    expect(progressResults.every((result) => result.status === 'saved')).toBe(
      true,
    );
    const savedProgress = await prisma.readingProgress.findUniqueOrThrow({
      where: { userId_storyId: { userId: reader.id, storyId: story.id } },
      select: {
        currentChapterId: true,
        position: true,
        lastReadAt: true,
        progressPercent: true,
      },
    });
    expect(savedProgress.currentChapterId).toBe(nextChapter.id);
    expect(savedProgress.position).toBe(200);
    expect(savedProgress.lastReadAt.getTime()).toBe(newerReadAt.getTime());
    expect(Number(savedProgress.progressPercent)).toBe(100);

    await readingHistory.saveProgress({
      userId: reader.id,
      storyId: story.id,
      chapterId: nextChapter.id,
      position: 10,
      readAt: olderReadAt,
    });
    const progressAfterStaleSameChapter =
      await prisma.readingProgress.findUniqueOrThrow({
        where: { userId_storyId: { userId: reader.id, storyId: story.id } },
        select: { currentChapterId: true, position: true, lastReadAt: true },
      });
    expect(progressAfterStaleSameChapter.currentChapterId).toBe(nextChapter.id);
    expect(progressAfterStaleSameChapter.position).toBe(200);
    expect(progressAfterStaleSameChapter.lastReadAt.getTime()).toBe(
      newerReadAt.getTime(),
    );
    const progressLibrary = await prisma.libraryEntry.findUniqueOrThrow({
      where: { userId_storyId: { userId: reader.id, storyId: story.id } },
      select: {
        lastReadChapterId: true,
        progressPercent: true,
        completedAt: true,
      },
    });
    expect(progressLibrary.lastReadChapterId).toBe(nextChapter.id);
    expect(Number(progressLibrary.progressPercent)).toBe(100);
    expect(progressLibrary.completedAt?.getTime()).toBe(newerReadAt.getTime());
    await expect(
      prisma.readingProgress.count({
        where: { userId: reader.id, storyId: story.id },
      }),
    ).resolves.toBe(1);

    const ratingResults = await Promise.all([
      ratings.upsert({
        userId: reader.id,
        storyId: story.id,
        score: 5,
        updatedAt: new Date(),
      }),
      ratings.upsert({
        userId: secondReader.id,
        storyId: story.id,
        score: 4,
        updatedAt: new Date(),
      }),
    ]);
    expect(ratingResults.every((result) => result.status === 'updated')).toBe(
      true,
    );
    const ratedStory = await prisma.story.findUniqueOrThrow({
      where: { id: story.id },
      select: { ratingCount: true, ratingAverage: true },
    });
    expect(ratedStory.ratingCount).toBe(2);
    expect(Number(ratedStory.ratingAverage)).toBe(4.5);

    await Promise.all([
      ratings.upsert({
        userId: reader.id,
        storyId: story.id,
        score: 3,
        updatedAt: new Date(),
      }),
      ratings.deleteMine(reader.id, story.id),
    ]);
    const activeRatings = await prisma.rating.aggregate({
      where: {
        storyId: story.id,
        deletedAt: null,
        moderationStatus: ModerationStatus.VISIBLE,
      },
      _count: { _all: true },
      _avg: { score: true },
    });
    const reconciledStory = await prisma.story.findUniqueOrThrow({
      where: { id: story.id },
      select: { ratingCount: true, ratingAverage: true },
    });
    expect(reconciledStory.ratingCount).toBe(activeRatings._count._all);
    expect(Number(reconciledStory.ratingAverage)).toBe(
      activeRatings._avg.score ?? 0,
    );

    const createdComment = await engagement.createComment({
      userId: reader.id,
      storyId: story.id,
      chapterId: chapter.id,
      body: 'A real reader comment',
      createdAt: new Date(),
    });
    expect(createdComment.status).toBe('created');
    if (createdComment.status !== 'created') return;

    const intruderUpdate = await engagement.updateComment({
      userId: secondReader.id,
      commentId: createdComment.comment.id,
      body: 'Must not overwrite',
      updatedAt: new Date(),
    });
    expect(intruderUpdate.status).toBe('not_found');

    const deleteResults = await Promise.all([
      engagement.deleteComment({
        userId: reader.id,
        commentId: createdComment.comment.id,
        deletedAt: new Date(),
      }),
      engagement.deleteComment({
        userId: reader.id,
        commentId: createdComment.comment.id,
        deletedAt: new Date(),
      }),
    ]);
    expect(deleteResults.map((result) => result.status).sort()).toEqual([
      'deleted',
      'not_found',
    ]);

    const counters = await Promise.all([
      prisma.story.findUniqueOrThrow({
        where: { id: story.id },
        select: { commentCount: true },
      }),
      prisma.chapter.findUniqueOrThrow({
        where: { id: chapter.id },
        select: { commentCount: true },
      }),
    ]);
    expect(counters[0].commentCount).toBe(0);
    expect(counters[1].commentCount).toBe(0);
  });

  it('allows an editable contributor to read and save but never submit, publish or manage the owner story', async () => {
    const owner = await createAuthor('contributor-owner');
    const editor = await createUser('contributor-editor');
    const story = await createStory(owner.id, StoryStatus.PUBLISHED, {
      publishedAt: new Date(),
    });
    const chapter = await createChapter(owner.id, story.id, 1);
    const workflow = moduleRef.get(PrismaChapterWorkflowPersistence);
    await prisma.storyContributor.create({
      data: {
        storyId: story.id,
        userId: editor.id,
        role: 'EDITOR',
        canEdit: false,
      },
    });
    await expect(
      chapters.findOwnedById(editor.id, story.id, chapter.id),
    ).resolves.toBeNull();
    await prisma.storyContributor.updateMany({
      where: { storyId: story.id, userId: editor.id },
      data: { canEdit: true },
    });
    expect(await stories.findOwnedById(editor.id, story.id)).not.toBeNull();
    expect(
      await chapters.findOwnedById(editor.id, story.id, chapter.id),
    ).not.toBeNull();
    const saved = await chapters.updateDraft({
      userId: editor.id,
      storyId: story.id,
      chapterId: chapter.id,
      expectedVersion: 1,
      title: 'Edited by contributor',
      updatedAt: new Date(),
      audit: audit('contributor-save'),
    });
    expect(saved.status).toBe('updated');
    await expect(
      workflow.transition({
        userId: editor.id,
        storyId: story.id,
        chapterId: chapter.id,
        expectedVersion: 2,
        action: 'submit',
        audit: {},
      }),
    ).rejects.toMatchObject({ category: 'FORBIDDEN' });
    expect(
      await chapters.publish({
        userId: editor.id,
        storyId: story.id,
        chapterId: chapter.id,
        publishedAt: new Date(),
        audit: {},
      }),
    ).toMatchObject({ status: 'not_found' });
    expect(
      await stories.updateDraft({
        userId: editor.id,
        storyId: story.id,
        title: 'Unauthorized',
        updatedAt: new Date(),
        audit: {},
      }),
    ).toMatchObject({ status: 'not_found' });
    await prisma.storyContributor.deleteMany({
      where: { storyId: story.id, userId: editor.id },
    });
    expect(
      await chapters.updateDraft({
        userId: editor.id,
        storyId: story.id,
        chapterId: chapter.id,
        expectedVersion: 2,
        title: 'Revoked',
        updatedAt: new Date(),
        audit: {},
      }),
    ).toMatchObject({ status: 'not_found' });
  });

  it('requires review before publication and records exactly one version-checked reviewer decision', async () => {
    const owner = await createAuthor('workflow-owner');
    const reviewer = await createReviewer('workflow-reviewer');
    const story = await createStory(owner.id, StoryStatus.PUBLISHED, {
      publishedAt: new Date(),
    });
    const chapter = await createChapter(owner.id, story.id, 1);
    const workflow = moduleRef.get(PrismaChapterWorkflowPersistence);
    expect(
      await chapters.publish({
        userId: owner.id,
        storyId: story.id,
        chapterId: chapter.id,
        publishedAt: new Date(),
        audit: {},
      }),
    ).toMatchObject({ status: 'not_draft' });
    expect(
      await chapters.schedule({
        userId: owner.id,
        storyId: story.id,
        chapterId: chapter.id,
        scheduledAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
        audit: {},
      }),
    ).toMatchObject({ status: 'not_schedulable' });
    const review = await workflow.transition({
      userId: owner.id,
      storyId: story.id,
      chapterId: chapter.id,
      expectedVersion: 1,
      action: 'submit',
      audit: audit('chapter-submit'),
    });
    expect(review).toMatchObject({ status: 'IN_REVIEW', version: 2 });
    /*
     * Sửa mở ở mọi giai đoạn, nên tác giả chỉnh lại chương ngay giữa lúc đang
     * duyệt. Bản sửa đẩy version lên, và chính cái đó chặn người duyệt bấm
     * duyệt một bản chữ họ chưa từng đọc.
     */
    expect(
      await chapters.updateDraft({
        userId: owner.id,
        storyId: story.id,
        chapterId: chapter.id,
        expectedVersion: 2,
        title: 'Sửa giữa lúc đang duyệt',
        updatedAt: new Date(),
        audit: {},
      }),
    ).toMatchObject({ status: 'updated', chapter: { version: 3 } });
    await expect(
      workflow.transition({
        userId: reviewer.id,
        chapterId: chapter.id,
        expectedVersion: 2,
        action: 'APPROVED',
        audit: audit('approve-stale-text'),
      }),
    ).rejects.toMatchObject({ code: 'CHAPTER_VERSION_CONFLICT' });
    const decisions = await Promise.allSettled([
      workflow.transition({
        userId: reviewer.id,
        chapterId: chapter.id,
        expectedVersion: 3,
        action: 'APPROVED',
        audit: audit('approve-chapter'),
      }),
      workflow.transition({
        userId: reviewer.id,
        chapterId: chapter.id,
        expectedVersion: 3,
        action: 'REQUEST_CHANGES',
        comment: 'More detail',
        audit: audit('reject-chapter'),
      }),
    ]);
    expect(
      decisions.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      decisions.find((result) => result.status === 'rejected'),
    ).toMatchObject({ reason: { code: 'CHAPTER_VERSION_CONFLICT' } });
    expect(
      await prisma.chapterReview.count({ where: { chapterId: chapter.id } }),
    ).toBe(1);
    expect(
      await prisma.chapterVersion.count({
        where: { chapterId: chapter.id, version: 4, isRetained: true },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: chapter.id,
          action: {
            in: [
              'chapter.workflow.approved',
              'chapter.workflow.request_changes',
            ],
          },
        },
      }),
    ).toBe(1);
    const current = await prisma.chapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    if (current.status === 'APPROVED') {
      await expect(
        workflow.transition({
          userId: owner.id,
          storyId: story.id,
          chapterId: chapter.id,
          expectedVersion: 3,
          action: 'reopen',
          audit: {},
        }),
      ).rejects.toMatchObject({ code: 'CHAPTER_VERSION_CONFLICT' });
      expect(
        await workflow.transition({
          userId: owner.id,
          storyId: story.id,
          chapterId: chapter.id,
          expectedVersion: 4,
          action: 'reopen',
          audit: {},
        }),
      ).toMatchObject({ status: 'DRAFT', version: 5 });
    }
  });

  it('edit session heartbeat cannot revive an expired session or mutate another editor session', async () => {
    const owner = await createAuthor('session-owner');
    const editor = await createUser('session-editor');
    const story = await createStory(owner.id, StoryStatus.DRAFT);
    const chapter = await createChapter(owner.id, story.id, 1);
    const sessions = moduleRef.get(PrismaChapterEditSessionPersistence);
    await prisma.storyContributor.create({
      data: {
        storyId: story.id,
        userId: editor.id,
        role: 'EDITOR',
        canEdit: true,
      },
    });
    const first = await sessions.save(
      owner.id,
      story.id,
      chapter.id,
      'owner-tab',
    );
    const second = await sessions.save(
      editor.id,
      story.id,
      chapter.id,
      'editor-tab',
    );
    expect(await sessions.list(owner.id, story.id, chapter.id)).toHaveLength(2);
    await expect(
      sessions.save(
        editor.id,
        story.id,
        chapter.id,
        'owner-tab',
        first.sessionToken,
      ),
    ).rejects.toMatchObject({ code: 'CHAPTER_EDIT_SESSION_EXPIRED' });
    await prisma.chapterEditSession.update({
      where: { id: second.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      sessions.save(
        editor.id,
        story.id,
        chapter.id,
        'editor-tab',
        second.sessionToken,
      ),
    ).rejects.toMatchObject({ code: 'CHAPTER_EDIT_SESSION_EXPIRED' });
    expect(await sessions.list(owner.id, story.id, chapter.id)).toHaveLength(1);
    await prisma.storyContributor.deleteMany({
      where: { storyId: story.id, userId: editor.id },
    });
    await expect(
      sessions.save(editor.id, story.id, chapter.id, 'editor-tab'),
    ).rejects.toMatchObject({ code: 'CHAPTER_NOT_FOUND' });
  });

  it('duyệt hàng loạt xử từng chương một và kể tên chương vướng', async () => {
    const owner = await createAuthor('bulk-approve-owner');
    const reviewer = await createReviewer('bulk-approve-reviewer');
    const story = await createStory(owner.id, StoryStatus.PUBLISHED, {
      publishedAt: new Date(),
    });
    const workflow = moduleRef.get(PrismaChapterWorkflowPersistence);

    const first = await createChapter(owner.id, story.id, 1, {
      status: ChapterStatus.IN_REVIEW,
    });
    const second = await createChapter(owner.id, story.id, 2, {
      status: ChapterStatus.IN_REVIEW,
    });
    /*
     * Truyện mà chính người duyệt có chân: luật "không tự duyệt truyện mình
     * tham gia" phải giữ nguyên trong lô, không thì lô là đường tắt quanh nó.
     */
    const ownStory = await createStory(owner.id, StoryStatus.DRAFT);
    await prisma.storyContributor.create({
      data: {
        storyId: ownStory.id,
        userId: reviewer.id,
        role: 'EDITOR',
        canEdit: true,
      },
    });
    const ownChapter = await createChapter(owner.id, ownStory.id, 1, {
      status: ChapterStatus.IN_REVIEW,
    });

    const result = await workflow.transitionMany({
      userId: reviewer.id,
      action: 'approve',
      audit: audit('bulk-approve'),
    });

    expect(result.succeeded.map((chapter) => chapter.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    expect(result.skipped).toEqual([
      expect.objectContaining({ chapterId: ownChapter.id }),
    ]);
    expect(result.remaining).toBe(0);

    const statuses = await prisma.chapter.findMany({
      where: { id: { in: [first.id, second.id, ownChapter.id] } },
      select: { id: true, status: true },
    });
    expect(
      statuses.filter((row) => row.status === ChapterStatus.APPROVED),
    ).toHaveLength(2);

    /*
     * Lô gọi lại chính `transition`, nên mỗi chương duyệt được phải có đúng một
     * bản ghi duyệt. Thiếu nó là lô đã đi đường tắt vòng qua quy trình.
     */
    expect(
      await prisma.chapterReview.count({
        where: { chapterId: { in: [first.id, second.id] } },
      }),
    ).toBe(2);
  });

  it('duyệt hàng loạt gói trong một truyện thì không đụng truyện khác', async () => {
    const owner = await createAuthor('bulk-scope-owner');
    const reviewer = await createReviewer('bulk-scope-reviewer');
    const target = await createStory(owner.id, StoryStatus.DRAFT);
    const other = await createStory(owner.id, StoryStatus.DRAFT);
    const inTarget = await createChapter(owner.id, target.id, 1, {
      status: ChapterStatus.IN_REVIEW,
    });
    const inOther = await createChapter(owner.id, other.id, 1, {
      status: ChapterStatus.IN_REVIEW,
    });
    const workflow = moduleRef.get(PrismaChapterWorkflowPersistence);

    const result = await workflow.transitionMany({
      userId: reviewer.id,
      action: 'approve',
      storyId: target.id,
      audit: audit('bulk-scope'),
    });

    expect(result.succeeded.map((chapter) => chapter.id)).toEqual([
      inTarget.id,
    ]);
    expect(
      await prisma.chapter.findUniqueOrThrow({
        where: { id: inOther.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: ChapterStatus.IN_REVIEW });
  });

  it('gửi duyệt hàng loạt bỏ qua chương rỗng thay vì làm hỏng cả lô', async () => {
    const owner = await createAuthor('bulk-submit-owner');
    const story = await createStory(owner.id, StoryStatus.DRAFT);
    const filled = await createChapter(owner.id, story.id, 1, {
      content: 'Có nội dung',
    });
    const empty = await createChapter(owner.id, story.id, 2, {
      content: '   ',
    });
    const workflow = moduleRef.get(PrismaChapterWorkflowPersistence);

    const result = await workflow.transitionMany({
      userId: owner.id,
      action: 'submit',
      storyId: story.id,
      audit: audit('bulk-submit'),
    });

    expect(result.succeeded.map((chapter) => chapter.id)).toEqual([filled.id]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        chapterId: empty.id,
        code: 'CHAPTER_EMPTY_CONTENT',
      }),
    ]);

    // Chương rỗng vẫn nằm nguyên ở bản nháp, không bị kéo theo lô.
    expect(
      await prisma.chapter.findUniqueOrThrow({
        where: { id: empty.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: ChapterStatus.DRAFT });
  });

  it('xuất bản hàng loạt chỉ lấy chương đã duyệt của truyện đã xuất bản', async () => {
    const owner = await createAuthor('bulk-publish-owner');
    const story = await createStory(owner.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const approved = await createChapter(owner.id, story.id, 1, {
      status: ChapterStatus.APPROVED,
    });
    const stillDraft = await createChapter(owner.id, story.id, 2);
    const approvedEmpty = await createChapter(owner.id, story.id, 3, {
      status: ChapterStatus.APPROVED,
      content: '',
    });

    const result = await chapters.publishMany({
      userId: owner.id,
      storyId: story.id,
      publishedAt: new Date(),
      audit: audit('bulk-publish'),
    });

    expect(result.published.map((chapter) => chapter.id)).toEqual([
      approved.id,
    ]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        chapterId: approvedEmpty.id,
        status: 'empty_content',
      }),
    ]);

    // Bản nháp không nằm trong lô này nên không được nhắc tới, cũng không đổi.
    expect(
      await prisma.chapter.findUniqueOrThrow({
        where: { id: stillDraft.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: ChapterStatus.DRAFT });
  });

  async function createReviewer(label: string): Promise<{ id: string }> {
    const user = await createUser(label);
    const permission = await prisma.permission.upsert({
      where: { code: 'chapter.manage.any' },
      update: {},
      create: {
        code: 'chapter.manage.any',
        name: 'Review chapters',
        resource: 'chapter',
        action: 'manage.any',
      },
    });
    const role = await prisma.role.upsert({
      where: { code: 'MODERATOR' },
      update: {},
      create: { code: 'MODERATOR', name: 'Moderator' },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      create: { roleId: role.id, permissionId: permission.id },
      update: {},
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    return user;
  }

  /*
   * Chèn chương vào giữa hai chương đã có. Cột `number` là Decimal(10, 2) nên
   * chỗ trống là hữu hạn: đây là test trên database thật, nơi khoá duy nhất
   * (story_id, number) và độ chính xác của cột thực sự tồn tại.
   */
  it('sửa chương đã xuất bản thì hiện ngay mà không đổi đường dẫn', async () => {
    const author = await createAuthor('edit-live');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const chapter = await createChapter(author.id, story.id, 1, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
      content: 'Bản gốc có lỗi chính tả.',
    });

    const updated = await chapters.updateDraft({
      userId: author.id,
      storyId: story.id,
      chapterId: chapter.id,
      title: 'Tiêu đề đã sửa',
      content: 'Bản đã sửa lỗi chính tả.',
      wordCount: 5,
      saveType: 'MANUAL_SAVE',
      updatedAt: new Date(),
      audit: audit('edit-live'),
    });

    expect(updated.status).toBe('updated');

    const fresh = await prisma.chapter.findUniqueOrThrow({
      where: { id: chapter.id },
      select: { title: true, slug: true, content: true, status: true },
    });

    // Độc giả thấy bản mới ngay: chương không bị rút về nháp để duyệt lại.
    expect(fresh.status).toBe(ChapterStatus.PUBLISHED);
    expect(fresh.content).toBe('Bản đã sửa lỗi chính tả.');
    expect(fresh.title).toBe('Tiêu đề đã sửa');
    // Nhưng đường dẫn giữ nguyên, nếu không thì mọi link đã chia sẻ chết.
    expect(fresh.slug).toBe(chapter.slug);

    // Bản cũ vẫn nằm trong lịch sử phiên bản nên khôi phục lại được.
    const history = await prisma.chapterVersion.findMany({
      where: { chapterId: chapter.id },
      select: { content: true },
    });
    expect(history.map((row) => row.content)).toContain(
      'Bản đã sửa lỗi chính tả.',
    );
  });

  it('không cho autosave hay bỏ trắng một chương độc giả đang đọc', async () => {
    const author = await createAuthor('live-guards');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const chapter = await createChapter(author.id, story.id, 1, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
      content: 'Nội dung đang hiển thị.',
    });

    /*
     * Autosave 2.5 giây một lần sẽ đẩy cả câu đang gõ dở ra cho độc giả, nên
     * chương đã lên bài chỉ nhận cái bấm Lưu của tác giả.
     */
    expect(
      await chapters.updateDraft({
        userId: author.id,
        storyId: story.id,
        chapterId: chapter.id,
        content: 'Đang gõ dở một câ',
        wordCount: 4,
        saveType: 'AUTOSAVE',
        updatedAt: new Date(),
        audit: audit('live-autosave'),
      }),
    ).toMatchObject({ status: 'autosave_not_allowed' });

    expect(
      await chapters.updateDraft({
        userId: author.id,
        storyId: story.id,
        chapterId: chapter.id,
        content: '   ',
        wordCount: 0,
        saveType: 'MANUAL_SAVE',
        updatedAt: new Date(),
        audit: audit('live-empty'),
      }),
    ).toMatchObject({ status: 'empty_content' });

    const fresh = await prisma.chapter.findUniqueOrThrow({
      where: { id: chapter.id },
      select: { content: true },
    });
    expect(fresh.content).toBe('Nội dung đang hiển thị.');
  });

  it('sửa được chương ngay cả khi truyện đang chờ duyệt', async () => {
    const author = await createAuthor('edit-pending');
    const story = await createStory(author.id, StoryStatus.PENDING_REVIEW);
    const chapter = await createChapter(author.id, story.id, 1);

    expect(
      await chapters.updateDraft({
        userId: author.id,
        storyId: story.id,
        chapterId: chapter.id,
        content: 'Viết tiếp trong lúc chờ duyệt.',
        wordCount: 6,
        saveType: 'MANUAL_SAVE',
        updatedAt: new Date(),
        audit: audit('edit-pending'),
      }),
    ).toMatchObject({ status: 'updated' });

    // Thêm chương mới cũng không còn bị chặn.
    expect(
      (
        await chapters.createDraft({
          userId: author.id,
          storyId: story.id,
          title: 'Chương mới khi đang chờ duyệt',
          content: 'Nội dung',
          wordCount: 1,
          createdAt: new Date(),
          audit: audit('create-pending'),
        })
      ).status,
    ).toBe('created');
  });

  it('sửa truyện đã xuất bản nhưng giữ đường dẫn và khoá định dạng', async () => {
    const author = await createAuthor('edit-published-story');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });

    const renamed = await stories.updateDraft({
      userId: author.id,
      storyId: story.id,
      title: 'Tên truyện hoàn toàn mới',
      synopsis: 'Tóm tắt viết lại.',
      updatedAt: new Date(),
      audit: audit('rename-published'),
    });

    expect(renamed.status).toBe('updated');
    if (renamed.status !== 'updated') return;
    expect(renamed.story.title).toBe('Tên truyện hoàn toàn mới');
    // Repo không có bảng redirect slug cũ, nên đổi slug là giết mọi link cũ.
    expect(renamed.story.slug).toBe(story.slug);

    /*
     * Chương truyện chữ lưu nội dung ở `content`, chương truyện tranh lưu ở
     * các trang ảnh. Lật định dạng khi độc giả đang đọc là mọi chương cũ hoá
     * trang trắng.
     */
    expect(
      await stories.updateDraft({
        userId: author.id,
        storyId: story.id,
        format: 'MANGA',
        updatedAt: new Date(),
        audit: audit('flip-format'),
      }),
    ).toMatchObject({ status: 'format_locked' });
  });

  it('chèn chương mở đầu trước chương đầu tiên đã xuất bản', async () => {
    const author = await createAuthor('insert-prologue');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const first = await createChapter(author.id, story.id, 1, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
    });
    const second = await createChapter(author.id, story.id, 2, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    const created = await chapters.createDraft({
      userId: author.id,
      storyId: story.id,
      title: 'Mở đầu',
      content: 'Chương mở đầu viết sau.',
      wordCount: 5,
      beforeChapterId: first.id,
      createdAt: new Date(),
      audit: audit('insert-prologue'),
    });

    expect(created.status).toBe('created');
    if (created.status !== 'created') return;
    // Chia đôi khoảng từ 0 tới số của chương đầu.
    expect(created.chapter.number).toBe(0.5);
    expect(created.chapter.slug).toContain('chuong-0-5');

    const ordered = await prisma.chapter.findMany({
      where: { storyId: story.id },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, slug: true },
    });

    // Chương mở đầu đứng trước, và hai chương cũ giữ nguyên số lẫn slug.
    expect(ordered.map((row) => row.number.toNumber())).toEqual([0.5, 1, 2]);
    expect(ordered[1]).toMatchObject({ id: first.id, slug: first.slug });
    expect(ordered[2]).toMatchObject({ id: second.id, slug: second.slug });
  });

  it('chèn liên tiếp nhiều chương mở đầu rồi báo hết chỗ', async () => {
    const author = await createAuthor('prologue-stack');
    const story = await createStory(author.id, StoryStatus.DRAFT);
    await createChapter(author.id, story.id, 1);

    /*
     * Cột `Decimal(10, 2)` chỉ giữ hai chữ số thập phân nên khoảng trước chương
     * 1 có đáy: 0.5, 0.25, 0.12, 0.06, 0.03, 0.01 rồi hết.
     */
    const numbers: number[] = [];

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const firstNow = await prisma.chapter.findFirstOrThrow({
        where: { storyId: story.id },
        orderBy: { number: 'asc' },
        select: { id: true },
      });
      const result = await chapters.createDraft({
        userId: author.id,
        storyId: story.id,
        title: `Mở đầu ${attempt}`,
        content: 'Nội dung',
        wordCount: 1,
        beforeChapterId: firstNow.id,
        createdAt: new Date(),
        audit: audit(`prologue-${attempt}`),
      });

      if (result.status === 'created') {
        numbers.push(result.chapter.number);
        continue;
      }

      expect(result).toMatchObject({ status: 'no_gap', afterNumber: 0 });
      break;
    }

    expect(numbers).toEqual([0.5, 0.25, 0.12, 0.06, 0.03, 0.01]);
  });

  it('không chèn được trước một chương đã bị xoá', async () => {
    const author = await createAuthor('prologue-missing');
    const story = await createStory(author.id, StoryStatus.DRAFT);
    const first = await createChapter(author.id, story.id, 1);
    await prisma.chapter.update({
      where: { id: first.id },
      data: { deletedAt: new Date() },
    });

    expect(
      await chapters.createDraft({
        userId: author.id,
        storyId: story.id,
        title: 'Mở đầu',
        content: 'Nội dung',
        wordCount: 1,
        beforeChapterId: first.id,
        createdAt: new Date(),
        audit: audit('prologue-missing'),
      }),
    ).toMatchObject({ status: 'anchor_not_found' });
  });

  it('chèn chương vào giữa hai chương đã xuất bản mà không đụng số của chúng', async () => {
    const author = await createAuthor('insert-between');
    const story = await createStory(author.id, StoryStatus.PUBLISHED, {
      visibility: StoryVisibility.PUBLIC,
      publishedAt: new Date(),
    });
    const first = await createChapter(author.id, story.id, 1, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
    });
    const second = await createChapter(author.id, story.id, 2, {
      status: ChapterStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    const created = await chapters.createDraft({
      userId: author.id,
      storyId: story.id,
      title: 'Ngoại truyện',
      content: 'Bổ sung ý giữa hai chương.',
      wordCount: 5,
      afterChapterId: first.id,
      createdAt: new Date(),
      audit: audit('insert-between'),
    });

    expect(created.status).toBe('created');
    if (created.status !== 'created') return;
    expect(created.chapter.number).toBe(1.5);
    expect(created.chapter.slug).toContain('chuong-1-5');

    const [freshFirst, freshSecond] = await Promise.all([
      prisma.chapter.findUniqueOrThrow({
        where: { id: first.id },
        select: { number: true, slug: true, status: true },
      }),
      prisma.chapter.findUniqueOrThrow({
        where: { id: second.id },
        select: { number: true, slug: true, status: true },
      }),
    ]);

    // Chương đã xuất bản giữ nguyên số và slug, nên link độc giả đã lưu không gãy.
    expect(freshFirst.number.toNumber()).toBe(1);
    expect(freshSecond.number.toNumber()).toBe(2);
    expect(freshSecond.slug).toBe(second.slug);
    expect(freshSecond.status).toBe(ChapterStatus.PUBLISHED);

    const order = await prisma.chapter.findMany({
      where: { storyId: story.id },
      orderBy: { number: 'asc' },
      select: { number: true },
    });
    expect(order.map((row) => row.number.toNumber())).toEqual([1, 1.5, 2]);
  });

  it('chèn tiếp vào khoảng đã hẹp lại', async () => {
    const author = await createAuthor('insert-twice');
    const story = await createStory(author.id, StoryStatus.DRAFT);
    const first = await createChapter(author.id, story.id, 1);
    await createChapter(author.id, story.id, 2);

    const insert = () =>
      chapters.createDraft({
        userId: author.id,
        storyId: story.id,
        title: 'Chen ngang',
        content: 'Nội dung',
        wordCount: 2,
        afterChapterId: first.id,
        createdAt: new Date(),
        audit: audit('insert-twice'),
      });

    const firstInsert = await insert();
    const secondInsert = await insert();

    expect(firstInsert.status).toBe('created');
    expect(secondInsert.status).toBe('created');
    if (firstInsert.status !== 'created' || secondInsert.status !== 'created')
      return;

    expect(firstInsert.chapter.number).toBe(1.5);
    expect(secondInsert.chapter.number).toBe(1.25);
  });

  it('từ chối khi hai chương đã sát nhau, thay vì làm vỡ khoá duy nhất', async () => {
    const author = await createAuthor('insert-no-gap');
    const story = await createStory(author.id, StoryStatus.DRAFT);
    const first = await createChapter(author.id, story.id, 1.5);
    await createChapter(author.id, story.id, 1.51);

    const result = await chapters.createDraft({
      userId: author.id,
      storyId: story.id,
      title: 'Không còn chỗ',
      content: 'Nội dung',
      wordCount: 2,
      afterChapterId: first.id,
      createdAt: new Date(),
      audit: audit('insert-no-gap'),
    });

    expect(result).toMatchObject({
      status: 'no_gap',
      afterNumber: 1.5,
      beforeNumber: 1.51,
    });

    const count = await prisma.chapter.count({ where: { storyId: story.id } });
    expect(count).toBe(2);
  });

  it('không cho lấy chương của truyện khác làm mốc chèn', async () => {
    const author = await createAuthor('insert-foreign');
    const story = await createStory(author.id, StoryStatus.DRAFT);
    const otherStory = await createStory(author.id, StoryStatus.DRAFT);
    const foreign = await createChapter(author.id, otherStory.id, 1);

    const result = await chapters.createDraft({
      userId: author.id,
      storyId: story.id,
      title: 'Mốc lạ',
      content: 'Nội dung',
      wordCount: 2,
      afterChapterId: foreign.id,
      createdAt: new Date(),
      audit: audit('insert-foreign'),
    });

    expect(result.status).toBe('anchor_not_found');
  });

  it('chèn sau chương cuối thì thành thêm vào đuôi với số nguyên', async () => {
    const author = await createAuthor('insert-tail');
    const story = await createStory(author.id, StoryStatus.DRAFT);
    await createChapter(author.id, story.id, 1);
    const last = await createChapter(author.id, story.id, 1.5);

    const created = await chapters.createDraft({
      userId: author.id,
      storyId: story.id,
      title: 'Chương kế',
      content: 'Nội dung',
      wordCount: 2,
      afterChapterId: last.id,
      createdAt: new Date(),
      audit: audit('insert-tail'),
    });

    expect(created.status).toBe('created');
    if (created.status !== 'created') return;
    expect(created.chapter.number).toBe(2);
  });

  /**
   * Chương truyện tranh không có một chữ nào: nội dung của nó là các trang ảnh
   * trong `chapter_media`. Cổng gửi duyệt chỉ đếm `content` thì truyện tranh
   * lúc nào cũng bị báo thiếu chương và không bao giờ gửi duyệt được.
   */
  it('gửi duyệt được truyện tranh có chương toàn trang ảnh', async () => {
    const author = await createAuthor('manga-submit');
    const ready = await createReviewReadyDraft(author.id, {
      chapterContent: '',
      pages: 3,
    });

    const submitted = await stories.submitForReview({
      userId: author.id,
      storyId: ready.storyId,
      authorNote: 'Truyện tranh sẵn sàng',
      submittedAt: new Date(),
      audit: audit('manga-submit'),
    });

    expect(submitted.status).toBe('submitted');
  });

  it('vẫn chặn truyện mà chương không có cả chữ lẫn trang ảnh', async () => {
    const author = await createAuthor('empty-submit');
    const ready = await createReviewReadyDraft(author.id, {
      chapterContent: '   ',
    });

    const submitted = await stories.submitForReview({
      userId: author.id,
      storyId: ready.storyId,
      authorNote: 'Chưa có gì',
      submittedAt: new Date(),
      audit: audit('empty-submit'),
    });

    expect(submitted).toMatchObject({
      status: 'not_ready',
      missing: ['chapter'],
    });
  });

  async function createReviewReadyDraft(
    userId: string,
    options: { readonly chapterContent?: string; readonly pages?: number } = {},
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
    const chapter = await createChapter(userId, story.id, 1, {
      content: options.chapterContent ?? 'Nội dung hợp lệ.',
    });

    for (let index = 0; index < (options.pages ?? 0); index += 1) {
      const page = await prisma.mediaAsset.create({
        data: {
          uploaderId: userId,
          purpose: MediaPurpose.CHAPTER_IMAGE,
          status: MediaStatus.READY,
          resourceType: MediaResourceType.IMAGE,
          storageProvider: 'integration-test',
          publicId: unique(`page-${index}`),
          secureUrl: 'https://example.test/page.webp',
          readyAt: new Date(),
        },
      });
      await prisma.chapterMedia.create({
        data: {
          chapterId: chapter.id,
          mediaAssetId: page.id,
          sortOrder: index,
        },
      });
    }

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
      where: {
        OR: [{ actorId: { in: userIds } }, { requestId: { contains: runId } }],
      },
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
