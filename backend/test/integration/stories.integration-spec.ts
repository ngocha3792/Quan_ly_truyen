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
    expect(
      await chapters.updateDraft({
        userId: owner.id,
        storyId: story.id,
        chapterId: chapter.id,
        expectedVersion: 2,
        title: 'Bypass review',
        updatedAt: new Date(),
        audit: {},
      }),
    ).toMatchObject({ status: 'not_draft' });
    const decisions = await Promise.allSettled([
      workflow.transition({
        userId: reviewer.id,
        chapterId: chapter.id,
        expectedVersion: 2,
        action: 'APPROVED',
        audit: audit('approve-chapter'),
      }),
      workflow.transition({
        userId: reviewer.id,
        chapterId: chapter.id,
        expectedVersion: 2,
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
        where: { chapterId: chapter.id, version: 3, isRetained: true },
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
          expectedVersion: 2,
          action: 'reopen',
          audit: {},
        }),
      ).rejects.toMatchObject({ code: 'CHAPTER_VERSION_CONFLICT' });
      expect(
        await workflow.transition({
          userId: owner.id,
          storyId: story.id,
          chapterId: chapter.id,
          expectedVersion: 3,
          action: 'reopen',
          audit: {},
        }),
      ).toMatchObject({ status: 'DRAFT', version: 4 });
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
