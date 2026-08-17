import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import type { AnalyticsConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import {
  analyticsDateKey,
  parseAnalyticsDate,
} from '../../domain/value-objects/analytics-time';

interface StoryAggregateRow {
  storyId: string;
  views: bigint;
  uniqueReaders: bigint;
  starts: bigint;
  completions: bigint;
  readingSeconds: bigint;
}
interface ChapterAggregateRow {
  chapterId: string;
  views: bigint;
  uniqueReaders: bigint;
  starts: bigint;
  completions: bigint;
  readingSeconds: bigint;
}

@Injectable()
export class PrismaAnalyticsReconciliationAdapter {
  private readonly analytics: AnalyticsConfig;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.analytics = config.getOrThrow<AnalyticsConfig>('analytics');
  }

  async recomputeUniqueReadersForEvents(
    eventIds: readonly string[],
  ): Promise<void> {
    if (eventIds.length === 0) return;
    const rows = await this.prisma.readerAnalyticsEvent.findMany({
      where: { id: { in: [...eventIds] }, processedAt: { not: null } },
      select: { occurredAt: true },
    });
    const dates = [
      ...new Set(
        rows.map((row) =>
          analyticsDateKey(row.occurredAt, this.analytics.timeZone),
        ),
      ),
    ];
    for (const dateKey of dates) await this.recomputeUniqueReaders(dateKey);
  }

  async recomputeUniqueReaders(dateKey: string): Promise<void> {
    const date = parseAnalyticsDate(dateKey);
    const [storyRows, chapterRows] = await Promise.all([
      this.prisma.$queryRaw<
        Pick<StoryAggregateRow, 'storyId' | 'uniqueReaders'>[]
      >(Prisma.sql`
        SELECT "story_id" AS "storyId", COUNT(DISTINCT "viewer_key_hash")::bigint AS "uniqueReaders"
        FROM "reader_analytics_events"
        WHERE "processed_at" IS NOT NULL
          AND "type" = 'story_view'
          AND ("occurred_at" AT TIME ZONE ${this.analytics.timeZone})::date = ${dateKey}::date
        GROUP BY "story_id"
      `),
      this.prisma.$queryRaw<
        Pick<ChapterAggregateRow, 'chapterId' | 'uniqueReaders'>[]
      >(Prisma.sql`
        SELECT "chapter_id" AS "chapterId", COUNT(DISTINCT "viewer_key_hash")::bigint AS "uniqueReaders"
        FROM "reader_analytics_events"
        WHERE "processed_at" IS NOT NULL
          AND "type" = 'chapter_view'
          AND "chapter_id" IS NOT NULL
          AND ("occurred_at" AT TIME ZONE ${this.analytics.timeZone})::date = ${dateKey}::date
        GROUP BY "chapter_id"
      `),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.storyDailyStat.updateMany({
        where: { date },
        data: { uniqueReaders: 0 },
      });
      await tx.chapterDailyStat.updateMany({
        where: { date },
        data: { uniqueReaders: 0 },
      });
      for (const row of storyRows) {
        await tx.storyDailyStat.upsert({
          where: { storyId_date: { storyId: row.storyId, date } },
          create: {
            storyId: row.storyId,
            date,
            uniqueReaders: Number(row.uniqueReaders),
          },
          update: { uniqueReaders: Number(row.uniqueReaders) },
        });
      }
      for (const row of chapterRows) {
        await tx.chapterDailyStat.upsert({
          where: { chapterId_date: { chapterId: row.chapterId, date } },
          create: {
            chapterId: row.chapterId,
            date,
            uniqueReaders: Number(row.uniqueReaders),
          },
          update: { uniqueReaders: Number(row.uniqueReaders) },
        });
      }
    });
    this.metrics.recordReaderAnalyticsProcessed('reconcile', 'success');
  }

  async hasUnprocessedEvents(dateKey: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "reader_analytics_events"
      WHERE "processed_at" IS NULL
        AND ("occurred_at" AT TIME ZONE ${this.analytics.timeZone})::date = ${dateKey}::date
    `);
    return Number(rows[0]?.count ?? 0n) > 0;
  }

  async reconcileSettledDate(dateKey: string): Promise<boolean> {
    if (await this.hasUnprocessedEvents(dateKey)) {
      this.metrics.recordReaderAnalyticsProcessed('reconcile', 'skipped');
      return false;
    }
    const date = parseAnalyticsDate(dateKey);
    const [storyRows, chapterRows, storedStories, storedChapters] =
      await Promise.all([
        this.storyAggregates(dateKey),
        this.chapterAggregates(dateKey),
        this.prisma.storyDailyStat.findMany({ where: { date } }),
        this.prisma.chapterDailyStat.findMany({ where: { date } }),
      ]);
    const storyExpected = new Map(storyRows.map((row) => [row.storyId, row]));
    const chapterExpected = new Map(
      chapterRows.map((row) => [row.chapterId, row]),
    );
    if (
      storedStories.some(
        (row) => !this.storyMatches(row, storyExpected.get(row.storyId)),
      ) ||
      storyRows.some(
        (row) =>
          !storedStories.some((stored) => stored.storyId === row.storyId),
      )
    ) {
      this.metrics.recordReaderAnalyticsReconciliationMismatch('story');
    }
    if (
      storedChapters.some(
        (row) => !this.chapterMatches(row, chapterExpected.get(row.chapterId)),
      ) ||
      chapterRows.some(
        (row) =>
          !storedChapters.some((stored) => stored.chapterId === row.chapterId),
      )
    ) {
      this.metrics.recordReaderAnalyticsReconciliationMismatch('chapter');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.storyDailyStat.updateMany({
        where: { date },
        data: {
          viewCount: 0n,
          uniqueReaders: 0,
          readingStartCount: 0,
          completionCount: 0,
          readingSeconds: 0n,
        },
      });
      await tx.chapterDailyStat.updateMany({
        where: { date },
        data: {
          viewCount: 0n,
          uniqueReaders: 0,
          readingStartCount: 0,
          completionCount: 0,
          readingSeconds: 0n,
        },
      });
      for (const row of storyRows) {
        await tx.storyDailyStat.upsert({
          where: { storyId_date: { storyId: row.storyId, date } },
          create: this.storyCreate(row, date),
          update: this.storyUpdate(row),
        });
      }
      for (const row of chapterRows) {
        await tx.chapterDailyStat.upsert({
          where: { chapterId_date: { chapterId: row.chapterId, date } },
          create: this.chapterCreate(row, date),
          update: this.chapterUpdate(row),
        });
      }
    });
    this.metrics.recordReaderAnalyticsProcessed('reconcile', 'success');
    return true;
  }

  async cleanupProcessedBatch(limit = 2000): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.analytics.rawEventRetentionDays * 24 * 60 * 60 * 1000,
    );
    const rows = await this.prisma.readerAnalyticsEvent.findMany({
      where: { processedAt: { not: null }, receivedAt: { lt: cutoff } },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      take: Math.max(1, Math.min(5000, limit)),
      select: { id: true },
    });
    if (rows.length === 0) return 0;
    const deleted = await this.prisma.readerAnalyticsEvent.deleteMany({
      where: {
        id: { in: rows.map((row) => row.id) },
        processedAt: { not: null },
      },
    });
    this.metrics.recordReaderAnalyticsProcessed('cleanup', 'success');
    return deleted.count;
  }

  async storyAggregates(dateKey: string): Promise<StoryAggregateRow[]> {
    return this.prisma.$queryRaw<StoryAggregateRow[]>(Prisma.sql`
      SELECT
        "story_id" AS "storyId",
        COUNT(*) FILTER (WHERE "type" = 'story_view')::bigint AS "views",
        COUNT(DISTINCT "viewer_key_hash") FILTER (WHERE "type" = 'story_view')::bigint AS "uniqueReaders",
        COUNT(*) FILTER (WHERE "type" = 'reading_started')::bigint AS "starts",
        COUNT(*) FILTER (WHERE "type" = 'reading_completed')::bigint AS "completions",
        COALESCE(SUM("active_seconds") FILTER (WHERE "type" = 'reading_progress'), 0)::bigint AS "readingSeconds"
      FROM "reader_analytics_events"
      WHERE "processed_at" IS NOT NULL
        AND ("occurred_at" AT TIME ZONE ${this.analytics.timeZone})::date = ${dateKey}::date
      GROUP BY "story_id"
    `);
  }

  async chapterAggregates(dateKey: string): Promise<ChapterAggregateRow[]> {
    return this.prisma.$queryRaw<ChapterAggregateRow[]>(Prisma.sql`
      SELECT
        "chapter_id" AS "chapterId",
        COUNT(*) FILTER (WHERE "type" = 'chapter_view')::bigint AS "views",
        COUNT(DISTINCT "viewer_key_hash") FILTER (WHERE "type" = 'chapter_view')::bigint AS "uniqueReaders",
        COUNT(*) FILTER (WHERE "type" = 'reading_started')::bigint AS "starts",
        COUNT(*) FILTER (WHERE "type" = 'reading_completed')::bigint AS "completions",
        COALESCE(SUM("active_seconds") FILTER (WHERE "type" = 'reading_progress'), 0)::bigint AS "readingSeconds"
      FROM "reader_analytics_events"
      WHERE "processed_at" IS NOT NULL
        AND "chapter_id" IS NOT NULL
        AND ("occurred_at" AT TIME ZONE ${this.analytics.timeZone})::date = ${dateKey}::date
      GROUP BY "chapter_id"
    `);
  }

  private storyMatches(
    stored: {
      viewCount: bigint;
      uniqueReaders: number;
      readingStartCount: number;
      completionCount: number;
      readingSeconds: bigint;
    },
    expected?: StoryAggregateRow,
  ): boolean {
    return (
      stored.viewCount === (expected?.views ?? 0n) &&
      stored.uniqueReaders === Number(expected?.uniqueReaders ?? 0n) &&
      stored.readingStartCount === Number(expected?.starts ?? 0n) &&
      stored.completionCount === Number(expected?.completions ?? 0n) &&
      stored.readingSeconds === (expected?.readingSeconds ?? 0n)
    );
  }

  private chapterMatches(
    stored: {
      viewCount: bigint;
      uniqueReaders: number;
      readingStartCount: number;
      completionCount: number;
      readingSeconds: bigint;
    },
    expected?: ChapterAggregateRow,
  ): boolean {
    return (
      stored.viewCount === (expected?.views ?? 0n) &&
      stored.uniqueReaders === Number(expected?.uniqueReaders ?? 0n) &&
      stored.readingStartCount === Number(expected?.starts ?? 0n) &&
      stored.completionCount === Number(expected?.completions ?? 0n) &&
      stored.readingSeconds === (expected?.readingSeconds ?? 0n)
    );
  }

  private storyCreate(row: StoryAggregateRow, date: Date) {
    return {
      storyId: row.storyId,
      date,
      viewCount: row.views,
      uniqueReaders: Number(row.uniqueReaders),
      readingStartCount: Number(row.starts),
      completionCount: Number(row.completions),
      readingSeconds: row.readingSeconds,
    };
  }
  private storyUpdate(row: StoryAggregateRow) {
    return {
      viewCount: row.views,
      uniqueReaders: Number(row.uniqueReaders),
      readingStartCount: Number(row.starts),
      completionCount: Number(row.completions),
      readingSeconds: row.readingSeconds,
    };
  }
  private chapterCreate(row: ChapterAggregateRow, date: Date) {
    return {
      chapterId: row.chapterId,
      date,
      viewCount: row.views,
      uniqueReaders: Number(row.uniqueReaders),
      readingStartCount: Number(row.starts),
      completionCount: Number(row.completions),
      readingSeconds: row.readingSeconds,
    };
  }
  private chapterUpdate(row: ChapterAggregateRow) {
    return {
      viewCount: row.views,
      uniqueReaders: Number(row.uniqueReaders),
      readingStartCount: Number(row.starts),
      completionCount: Number(row.completions),
      readingSeconds: row.readingSeconds,
    };
  }
}
