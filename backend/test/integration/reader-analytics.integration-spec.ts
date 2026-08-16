import { createHmac, randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { AppConfigModule } from '@/config';
import {
  AccountStatus,
  AuthorLifecycleStatus,
  AuthorVerificationStatus,
  ChapterStatus,
  ReaderAnalyticsEventType,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import { AnalyticsAggregationService } from '@/modules/analytics/infrastructure/analytics-aggregation.service';
import { AnalyticsReconciliationService } from '@/modules/analytics/infrastructure/analytics-reconciliation.service';
import { AnalyticsIdentityService } from '@/modules/analytics/application/analytics-identity.service';
import { ReaderAnalyticsIngestionService } from '@/modules/analytics/application/reader-analytics-ingestion.service';
import { AuthorAnalyticsService } from '@/modules/analytics/application/author-analytics.service';
import { analyticsDateKey } from '@/modules/analytics/domain/analytics-time.util';

const runId = randomUUID().replaceAll('-', '').slice(0, 10);
let seq = 0;
const unique = (prefix: string) => `${prefix}-${runId}-${++seq}`;

describe('Phase 6 reader analytics', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let aggregate: AnalyticsAggregationService;
  let reconcile: AnalyticsReconciliationService;
  let identity: AnalyticsIdentityService;
  let authorAnalytics: AuthorAnalyticsService;
  const createdUsers = new Set<string>();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        AnalyticsAggregationService,
        AnalyticsReconciliationService,
        AnalyticsIdentityService,
        AuthorAnalyticsService,
        {
          provide: MetricsService,
          useValue: {
            recordReaderAnalyticsProcessed: jest.fn(),
            recordReaderAnalyticsReconciliationMismatch: jest.fn(),
          },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    aggregate = moduleRef.get(AnalyticsAggregationService);
    reconcile = moduleRef.get(AnalyticsReconciliationService);
    identity = moduleRef.get(AnalyticsIdentityService);
    authorAnalytics = moduleRef.get(AuthorAnalyticsService);
  });

  afterEach(async () => cleanup());
  afterAll(async () => { await cleanup(); await moduleRef.close(); });

  it('uses keyed HMAC identities without persisting a raw reader id', async () => {
    const userId = randomUUID();
    const first = identity.hashAuthenticated(userId);
    const second = identity.hashAuthenticated(userId);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toContain(userId);
    expect(first).toBe(
      createHmac('sha256', process.env.ANALYTICS_IDENTITY_HMAC_SECRET ?? 'development-analytics-identity-secret-change-me')
        .update(`user:${userId}`)
        .digest('hex'),
    );
  });

  it('ingests idempotently, hashes anonymous identity and rejects spoofed chapter context', async () => {
    const { storyId, chapterId } = await createPublishedStory('ingest');
    const other = await createPublishedStory('ingest-other');
    const actualConfig = moduleRef.get(ConfigService);
    const analyticsConfig = { ...actualConfig.getOrThrow('analytics'), enabled: true };
    const fakeConfig = { getOrThrow: (key: string) => key === 'analytics' ? analyticsConfig : actualConfig.getOrThrow(key) } as ConfigService;
    const localIdentity = new AnalyticsIdentityService(fakeConfig);
    const metrics = {
      recordReaderAnalyticsReceived: jest.fn(),
      recordReaderAnalyticsRejected: jest.fn(),
      recordReaderAnalyticsProcessed: jest.fn(),
    } as unknown as MetricsService;
    const ingestion = new ReaderAnalyticsIngestionService(
      prisma,
      fakeConfig,
      localIdentity,
      { consume: jest.fn().mockResolvedValue(undefined) } as never,
      metrics,
      undefined,
    );
    const anonymousReaderId = randomUUID();
    const eventId = randomUUID();
    const sessionId = randomUUID();
    const event = {
      eventId,
      type: ReaderAnalyticsEventType.CHAPTER_VIEW,
      version: 1,
      sessionId,
      storyId,
      chapterId,
      occurredAt: new Date().toISOString(),
    } as const;
    const result = await ingestion.ingest({ anonymousReaderId, events: [event, event] });
    expect(result).toMatchObject({ accepted: 1, duplicates: 1, rejected: 0 });
    const raw = await prisma.readerAnalyticsEvent.findUniqueOrThrow({ where: { eventId } });
    expect(raw.viewerKeyHash).toBe(localIdentity.hashAnonymous(anonymousReaderId));
    expect(JSON.stringify(raw)).not.toContain(anonymousReaderId);

    await expect(ingestion.ingest({ anonymousReaderId, events: [{ ...event, eventId: randomUUID(), storyId: other.storyId }] }))
      .rejects.toMatchObject({ code: 'ANALYTICS_CHAPTER_STORY_MISMATCH' });
    await expect(ingestion.ingest({ anonymousReaderId, events: [{ ...event, eventId: randomUUID(), occurredAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }] }))
      .rejects.toMatchObject({ code: 'ANALYTICS_INVALID_OCCURRED_AT' });
  });

  it('aggregates accepted events once even when the same worker batch is replayed', async () => {
    const { authorId, storyId, chapterId } = await createPublishedStory('replay');
    const viewer = identity.hashAnonymous(randomUUID());
    const sessionId = randomUUID();
    const occurredAt = new Date();
    const events = await Promise.all([
      createEvent({ type: ReaderAnalyticsEventType.STORY_VIEW, viewer, sessionId: randomUUID(), storyId, occurredAt }),
      createEvent({ type: ReaderAnalyticsEventType.CHAPTER_VIEW, viewer, sessionId, storyId, chapterId, occurredAt }),
      createEvent({ type: ReaderAnalyticsEventType.READING_STARTED, viewer, sessionId, storyId, chapterId, occurredAt }),
      createEvent({ type: ReaderAnalyticsEventType.READING_PROGRESS, viewer, sessionId, storyId, chapterId, occurredAt, progressPercent: 50, activeSeconds: 15 }),
      createEvent({ type: ReaderAnalyticsEventType.READING_COMPLETED, viewer, sessionId, storyId, chapterId, occurredAt, progressPercent: 95 }),
    ]);
    const ids = events.map((event) => event.id);
    await expect(aggregate.processEventIds(ids)).resolves.toBe(5);
    await expect(aggregate.processEventIds(ids)).resolves.toBe(0);

    const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
    const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });
    expect(story.viewCount).toBe(1n);
    expect(chapter.viewCount).toBe(1n);
    const stats = await prisma.storyDailyStat.findFirstOrThrow({ where: { storyId } });
    expect(stats.viewCount).toBe(1n);
    expect(stats.readingStartCount).toBe(1);
    expect(stats.completionCount).toBe(1);
    expect(stats.readingSeconds).toBe(15n);
    expect(await prisma.readerAnalyticsEvent.count({ where: { id: { in: ids }, processedAt: { not: null } } })).toBe(5);
    expect(authorId).toBeTruthy();
  });

  it('recomputes daily unique viewers canonically rather than incrementing repeats', async () => {
    const { storyId, chapterId } = await createPublishedStory('unique');
    const a = identity.hashAnonymous(randomUUID());
    const b = identity.hashAnonymous(randomUUID());
    const occurredAt = new Date();
    const rows = await Promise.all([
      createEvent({ type: ReaderAnalyticsEventType.STORY_VIEW, viewer: a, sessionId: randomUUID(), storyId, occurredAt }),
      createEvent({ type: ReaderAnalyticsEventType.STORY_VIEW, viewer: a, sessionId: randomUUID(), storyId, occurredAt }),
      createEvent({ type: ReaderAnalyticsEventType.STORY_VIEW, viewer: b, sessionId: randomUUID(), storyId, occurredAt }),
      createEvent({ type: ReaderAnalyticsEventType.CHAPTER_VIEW, viewer: a, sessionId: randomUUID(), storyId, chapterId, occurredAt }),
      createEvent({ type: ReaderAnalyticsEventType.CHAPTER_VIEW, viewer: b, sessionId: randomUUID(), storyId, chapterId, occurredAt }),
    ]);
    await aggregate.processEventIds(rows.map((row) => row.id));
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.ANALYTICS_TIME_ZONE ?? 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(occurredAt);
    await reconcile.recomputeUniqueReaders(dateKey);
    await reconcile.recomputeUniqueReaders(dateKey);
    expect((await prisma.storyDailyStat.findFirstOrThrow({ where: { storyId } })).uniqueReaders).toBe(2);
    expect((await prisma.chapterDailyStat.findFirstOrThrow({ where: { chapterId } })).uniqueReaders).toBe(2);
  });

  it('uses the configured timezone for daily bucket boundaries', () => {
    expect(analyticsDateKey(new Date('2026-08-16T16:59:00.000Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-08-16');
    expect(analyticsDateKey(new Date('2026-08-16T17:01:00.000Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-08-17');
  });

  it('retention cleanup deletes only old processed raw events', async () => {
    const { storyId } = await createPublishedStory('retention');
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const processed = await prisma.readerAnalyticsEvent.create({ data: {
      eventId: randomUUID(), type: ReaderAnalyticsEventType.STORY_VIEW,
      viewerKeyHash: identity.hashAnonymous(randomUUID()), sessionId: randomUUID(), storyId,
      occurredAt: old, receivedAt: old, processedAt: new Date(old.getTime() + 1000),
    } });
    const unprocessed = await prisma.readerAnalyticsEvent.create({ data: {
      eventId: randomUUID(), type: ReaderAnalyticsEventType.STORY_VIEW,
      viewerKeyHash: identity.hashAnonymous(randomUUID()), sessionId: randomUUID(), storyId,
      occurredAt: old, receivedAt: old,
    } });
    await reconcile.cleanupProcessedBatch(100);
    expect(await prisma.readerAnalyticsEvent.findUnique({ where: { id: processed.id } })).toBeNull();
    expect(await prisma.readerAnalyticsEvent.findUnique({ where: { id: unprocessed.id } })).not.toBeNull();
  });

  it('enforces author ownership and returns null rate without a reading-start denominator', async () => {
    const own = await createPublishedStory('owner');
    const other = await createPublishedStory('other');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.ANALYTICS_TIME_ZONE ?? 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const ownView = await createEvent({ type: ReaderAnalyticsEventType.STORY_VIEW, viewer: identity.hashAnonymous(randomUUID()), sessionId: randomUUID(), storyId: own.storyId, occurredAt: new Date() });
    await aggregate.processEventIds([ownView.id]);
    const detail = await authorAnalytics.story(own.authorId, own.storyId, today, today);
    expect(detail.totals.views).toBe(1);
    expect(detail.totals.completionRate).toBeNull();
    await expect(authorAnalytics.story(own.authorId, other.storyId, today, today)).rejects.toMatchObject({ code: 'AUTHOR_ANALYTICS_STORY_NOT_FOUND' });
  });

  async function createEvent(input: {
    type: ReaderAnalyticsEventType; viewer: string; sessionId: string; storyId: string; chapterId?: string; occurredAt: Date; progressPercent?: number; activeSeconds?: number;
  }) {
    return prisma.readerAnalyticsEvent.create({ data: {
      eventId: randomUUID(), type: input.type, viewerKeyHash: input.viewer, sessionId: input.sessionId,
      storyId: input.storyId, chapterId: input.chapterId, occurredAt: input.occurredAt,
      progressPercent: input.progressPercent, activeSeconds: input.activeSeconds,
    } });
  }

  async function createPublishedStory(prefix: string) {
    const marker = unique(prefix).toLowerCase();
    const user = await prisma.user.create({ data: { email: `${marker}@example.test`, username: marker.slice(0, 45), displayName: marker, status: AccountStatus.ACTIVE } });
    createdUsers.add(user.id);
    await prisma.authorProfile.create({ data: { userId: user.id, penName: marker, slug: marker, verificationStatus: AuthorVerificationStatus.VERIFIED, lifecycleStatus: AuthorLifecycleStatus.ACTIVE } });
    const story = await prisma.story.create({ data: { authorId: user.id, title: marker, slug: unique('story').toLowerCase(), synopsis: 'analytics test', status: StoryStatus.PUBLISHED, visibility: StoryVisibility.PUBLIC, publishedAt: new Date() } });
    const chapter = await prisma.chapter.create({ data: { storyId: story.id, createdById: user.id, updatedById: user.id, number: '1', title: 'Chapter 1', slug: 'chapter-1', content: 'content', status: ChapterStatus.PUBLISHED, publishedAt: new Date() } });
    return { authorId: user.id, storyId: story.id, chapterId: chapter.id };
  }

  async function cleanup(): Promise<void> {
    const ids = [...createdUsers];
    if (!ids.length) return;
    await prisma.readerAnalyticsEvent.deleteMany({ where: { story: { authorId: { in: ids } } } });
    await prisma.story.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.authorProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    createdUsers.clear();
  }
});
