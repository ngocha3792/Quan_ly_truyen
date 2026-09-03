import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReaderAnalyticsEventType } from '@/generated/prisma/client';
import type { AnalyticsConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import { analyticsDate } from '../../domain/value-objects/analytics-time';

interface Delta {
  views: number;
  starts: number;
  completions: number;
  readingSeconds: number;
}

@Injectable()
export class PrismaAnalyticsAggregationAdapter {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.timeZone = config.getOrThrow<AnalyticsConfig>('analytics').timeZone;
  }

  async processEventIds(eventIds: readonly string[]): Promise<number> {
    if (eventIds.length === 0) return 0;
    const processed = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "reader_analytics_events"
        WHERE "id" IN (${Prisma.join(eventIds)})
          AND "processed_at" IS NULL
        FOR UPDATE
      `);
      const ids = locked.map((row) => row.id);
      if (ids.length === 0) return 0;
      const events = await tx.readerAnalyticsEvent.findMany({
        where: { id: { in: ids } },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      });

      for (const event of events) {
        const date = analyticsDate(event.occurredAt, this.timeZone);
        const delta = this.delta(event.type, event.activeSeconds ?? 0);
        await tx.storyDailyStat.upsert({
          where: { storyId_date: { storyId: event.storyId, date } },
          create: {
            storyId: event.storyId,
            date,
            viewCount: BigInt(delta.views),
            readingStartCount: delta.starts,
            completionCount: delta.completions,
            readingSeconds: BigInt(delta.readingSeconds),
          },
          update: {
            ...(delta.views
              ? { viewCount: { increment: BigInt(delta.views) } }
              : {}),
            ...(delta.starts
              ? { readingStartCount: { increment: delta.starts } }
              : {}),
            ...(delta.completions
              ? { completionCount: { increment: delta.completions } }
              : {}),
            ...(delta.readingSeconds
              ? { readingSeconds: { increment: BigInt(delta.readingSeconds) } }
              : {}),
          },
        });

        if (event.chapterId) {
          await tx.chapterDailyStat.upsert({
            where: { chapterId_date: { chapterId: event.chapterId, date } },
            create: {
              chapterId: event.chapterId,
              date,
              viewCount:
                event.type === ReaderAnalyticsEventType.CHAPTER_VIEW ? 1n : 0n,
              readingStartCount: delta.starts,
              completionCount: delta.completions,
              readingSeconds: BigInt(delta.readingSeconds),
            },
            update: {
              ...(event.type === ReaderAnalyticsEventType.CHAPTER_VIEW
                ? { viewCount: { increment: 1n } }
                : {}),
              ...(delta.starts
                ? { readingStartCount: { increment: delta.starts } }
                : {}),
              ...(delta.completions
                ? { completionCount: { increment: delta.completions } }
                : {}),
              ...(delta.readingSeconds
                ? {
                    readingSeconds: { increment: BigInt(delta.readingSeconds) },
                  }
                : {}),
            },
          });
        }

        if (event.type === ReaderAnalyticsEventType.STORY_VIEW) {
          await tx.story.update({
            where: { id: event.storyId },
            data: { viewCount: { increment: 1n } },
          });
        } else if (
          event.type === ReaderAnalyticsEventType.CHAPTER_VIEW &&
          event.chapterId
        ) {
          await tx.chapter.update({
            where: { id: event.chapterId },
            data: { viewCount: { increment: 1n } },
          });
        }

        await this.persistAuthenticatedReadingSession(tx, event);
      }

      await tx.readerAnalyticsEvent.updateMany({
        where: { id: { in: ids }, processedAt: null },
        data: { processedAt: new Date() },
      });
      return ids.length;
    });
    this.metrics.recordReaderAnalyticsProcessed(
      'aggregate',
      processed > 0 ? 'success' : 'skipped',
    );
    return processed;
  }

  private async persistAuthenticatedReadingSession(
    tx: Prisma.TransactionClient,
    event: {
      id: string;
      type: ReaderAnalyticsEventType;
      userId: string | null;
      sessionId: string;
      storyId: string;
      chapterId: string | null;
      progressPercent: Prisma.Decimal | null;
      activeSeconds: number | null;
      occurredAt: Date;
    },
  ): Promise<void> {
    if (
      !event.userId ||
      !event.chapterId ||
      (event.type !== ReaderAnalyticsEventType.READING_STARTED &&
        event.type !== ReaderAnalyticsEventType.READING_PROGRESS &&
        event.type !== ReaderAnalyticsEventType.READING_COMPLETED)
    ) {
      return;
    }

    const existing = await tx.readingSession.findUnique({
      where: { id: event.sessionId },
      select: { userId: true, storyId: true, chapterId: true },
    });
    if (
      existing &&
      (existing.userId !== event.userId ||
        existing.storyId !== event.storyId ||
        existing.chapterId !== event.chapterId)
    ) {
      return;
    }

    const position = Math.max(
      0,
      Math.min(100, Math.round(Number(event.progressPercent ?? 0))),
    );
    const activeSeconds = Math.max(0, Math.min(60, event.activeSeconds ?? 0));
    const completed = event.type === ReaderAnalyticsEventType.READING_COMPLETED;

    await tx.readingSession.upsert({
      where: { id: event.sessionId },
      create: {
        id: event.sessionId,
        userId: event.userId,
        storyId: event.storyId,
        chapterId: event.chapterId,
        startedAt: event.occurredAt,
        endedAt:
          event.type === ReaderAnalyticsEventType.READING_STARTED
            ? null
            : event.occurredAt,
        durationSeconds: activeSeconds,
        startPosition: position,
        endPosition: position,
        completed,
      },
      update: {
        endedAt: event.occurredAt,
        endPosition: position,
        ...(activeSeconds > 0
          ? { durationSeconds: { increment: activeSeconds } }
          : {}),
        ...(completed ? { completed: true } : {}),
      },
    });
  }

  private delta(type: ReaderAnalyticsEventType, activeSeconds: number): Delta {
    return {
      views: type === ReaderAnalyticsEventType.STORY_VIEW ? 1 : 0,
      starts: type === ReaderAnalyticsEventType.READING_STARTED ? 1 : 0,
      completions: type === ReaderAnalyticsEventType.READING_COMPLETED ? 1 : 0,
      readingSeconds:
        type === ReaderAnalyticsEventType.READING_PROGRESS
          ? Math.max(0, Math.min(60, activeSeconds))
          : 0,
    };
  }
}
