import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { AnalyticsConfig } from '@/config';
import {
  ChapterStatus,
  ReaderAnalyticsEventType,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { InvalidInputException } from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import { AnalyticsIdentityService } from './analytics-identity.service';
import { AnalyticsRateLimiterService } from './analytics-rate-limiter.service';
import type { ReaderAnalyticsEventRequest } from '../presentation/http/requests/ingest-reader-analytics.request';

const PUBLIC_STORY_STATUSES = [
  StoryStatus.PUBLISHED,
  StoryStatus.HIATUS,
  StoryStatus.COMPLETED,
] as const;

export interface ReaderAnalyticsIngestionResult {
  readonly accepted: number;
  readonly duplicates: number;
  readonly rejected: number;
  readonly disabled?: boolean;
}

@Injectable()
export class ReaderAnalyticsIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly identity: AnalyticsIdentityService,
    private readonly limiter: AnalyticsRateLimiterService,
    private readonly metrics: MetricsService,
    @Optional()
    @InjectQueue(QUEUE_NAMES.ANALYTICS)
    private readonly queue?: Queue,
  ) {}

  async ingest(input: {
    userId?: string;
    anonymousReaderId?: string;
    ipAddress?: string;
    events: readonly ReaderAnalyticsEventRequest[];
  }): Promise<ReaderAnalyticsIngestionResult> {
    const analytics = this.config.getOrThrow<AnalyticsConfig>('analytics');
    if (!analytics.enabled) {
      return { accepted: 0, duplicates: 0, rejected: 0, disabled: true };
    }
    if (input.events.length > analytics.maxBatchSize) {
      throw new InvalidInputException({
        code: 'ANALYTICS_BATCH_TOO_LARGE',
        message: `Analytics batch tối đa ${analytics.maxBatchSize} events`,
      });
    }

    const viewerKeyHash = input.userId
      ? this.identity.hashAuthenticated(input.userId)
      : input.anonymousReaderId
        ? this.identity.hashAnonymous(input.anonymousReaderId)
        : null;
    if (!viewerKeyHash) {
      throw new InvalidInputException({
        code: 'ANALYTICS_VIEWER_ID_REQUIRED',
        message: 'anonymousReaderId là bắt buộc cho reader chưa đăng nhập',
      });
    }

    await this.limiter.consume(viewerKeyHash, input.ipAddress);
    this.validateEvents(input.events, analytics);
    const canonical = await this.resolveCanonicalContext(input.events);

    const result = await this.prisma.readerAnalyticsEvent.createMany({
      data: canonical.map((event) => ({
        eventId: event.eventId,
        type: event.type,
        version: event.version,
        viewerKeyHash,
        sessionId: event.sessionId,
        storyId: event.storyId,
        chapterId: event.chapterId ?? null,
        progressPercent: event.progressPercent,
        activeSeconds: event.activeSeconds,
        occurredAt: event.occurredAt,
      })),
      skipDuplicates: true,
    });

    for (const event of canonical) {
      this.metrics.recordReaderAnalyticsReceived(event.type);
    }

    await this.tryQueueByEventIds(canonical.map((event) => event.eventId));

    return {
      accepted: result.count,
      duplicates: canonical.length - result.count,
      rejected: 0,
    };
  }

  private validateEvents(
    events: readonly ReaderAnalyticsEventRequest[],
    analytics: AnalyticsConfig,
  ): void {
    const now = Date.now();
    const oldest = now - 24 * 60 * 60 * 1000;
    const newest = now + 5 * 60 * 1000;
    for (const event of events) {
      const occurredAt = new Date(event.occurredAt).getTime();
      if (
        !Number.isFinite(occurredAt) ||
        occurredAt < oldest ||
        occurredAt > newest
      ) {
        this.metrics.recordReaderAnalyticsRejected('timestamp');
        throw new InvalidInputException({
          code: 'ANALYTICS_INVALID_OCCURRED_AT',
          message: 'Analytics event timestamp nằm ngoài khoảng cho phép',
        });
      }
      if (event.version !== 1) {
        throw new InvalidInputException({
          code: 'ANALYTICS_UNSUPPORTED_VERSION',
          message: 'Analytics event version chưa được hỗ trợ',
        });
      }
      if (event.type === ReaderAnalyticsEventType.STORY_VIEW) {
        if (
          event.chapterId ||
          event.progressPercent !== undefined ||
          event.activeSeconds !== undefined
        ) {
          throw this.invalidShape(event.type);
        }
        continue;
      }
      if (!event.chapterId) throw this.invalidShape(event.type);
      if (event.type === ReaderAnalyticsEventType.READING_PROGRESS) {
        if (
          event.progressPercent === undefined ||
          event.activeSeconds === undefined
        ) {
          throw this.invalidShape(event.type);
        }
      }
      if (event.type === ReaderAnalyticsEventType.READING_COMPLETED) {
        if (
          event.progressPercent === undefined ||
          event.progressPercent < analytics.completionThresholdPercent
        ) {
          throw new InvalidInputException({
            code: 'ANALYTICS_COMPLETION_THRESHOLD_NOT_MET',
            message: 'Reading completion chưa đạt ngưỡng cấu hình',
          });
        }
      }
    }
  }

  private invalidShape(type: ReaderAnalyticsEventType): InvalidInputException {
    this.metrics.recordReaderAnalyticsRejected('shape');
    return new InvalidInputException({
      code: 'ANALYTICS_EVENT_SHAPE_INVALID',
      message: `Payload không hợp lệ cho ${type}`,
    });
  }

  private async resolveCanonicalContext(
    events: readonly ReaderAnalyticsEventRequest[],
  ) {
    const storyIds = [...new Set(events.map((event) => event.storyId))];
    const chapterIds = [
      ...new Set(
        events.flatMap((event) => (event.chapterId ? [event.chapterId] : [])),
      ),
    ];
    const [stories, chapters] = await Promise.all([
      this.prisma.story.findMany({
        where: {
          id: { in: storyIds },
          deletedAt: null,
          visibility: StoryVisibility.PUBLIC,
          publishedAt: { not: null },
          status: { in: [...PUBLIC_STORY_STATUSES] },
        },
        select: { id: true },
      }),
      this.prisma.chapter.findMany({
        where: {
          id: { in: chapterIds },
          deletedAt: null,
          status: ChapterStatus.PUBLISHED,
          publishedAt: { not: null },
          story: {
            is: {
              deletedAt: null,
              visibility: StoryVisibility.PUBLIC,
              publishedAt: { not: null },
              status: { in: [...PUBLIC_STORY_STATUSES] },
            },
          },
        },
        select: { id: true, storyId: true },
      }),
    ]);
    const storySet = new Set(stories.map((story) => story.id));
    const chapterMap = new Map(
      chapters.map((chapter) => [chapter.id, chapter.storyId]),
    );

    return events.map((event) => {
      if (!storySet.has(event.storyId)) {
        this.metrics.recordReaderAnalyticsRejected('story');
        throw new InvalidInputException({
          code: 'ANALYTICS_STORY_NOT_PUBLIC',
          message: 'Story analytics context không hợp lệ',
        });
      }
      if (event.chapterId) {
        const canonicalStoryId = chapterMap.get(event.chapterId);
        if (!canonicalStoryId || canonicalStoryId !== event.storyId) {
          this.metrics.recordReaderAnalyticsRejected('context');
          throw new InvalidInputException({
            code: 'ANALYTICS_CHAPTER_STORY_MISMATCH',
            message: 'Chapter không thuộc Story đã khai báo',
          });
        }
      }
      return {
        ...event,
        occurredAt: new Date(event.occurredAt),
      };
    });
  }

  private async tryQueueByEventIds(eventIds: readonly string[]): Promise<void> {
    if (!this.queue || eventIds.length === 0) return;
    try {
      const rows = await this.prisma.readerAnalyticsEvent.findMany({
        where: {
          eventId: { in: [...eventIds] },
          queuedAt: null,
          processedAt: null,
        },
        select: { id: true },
      });
      if (rows.length === 0) return;
      await this.queue.add(
        'reader-analytics-batch',
        { eventIds: rows.map((row) => row.id) },
        { jobId: `analytics-batch-${randomUUID()}` },
      );
      await this.prisma.readerAnalyticsEvent.updateMany({
        where: { id: { in: rows.map((row) => row.id) }, queuedAt: null },
        data: { queuedAt: new Date() },
      });
    } catch {
      // Durable DB rows are the source of truth. The worker recovery dispatcher
      // will enqueue rows with queuedAt = null when Redis/queue recovers.
      this.metrics.recordReaderAnalyticsProcessed('queue', 'failed');
    }
  }
}
