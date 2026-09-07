import { Injectable } from '@nestjs/common';
import type { AuthorAnalyticsReaderPort } from '../../application/ports';
import { ConfigService } from '@nestjs/config';
import type { AnalyticsConfig } from '@/config';
import {
  AuthenticationRequiredException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import {
  derivedAnalyticsMetrics,
  safeBigInt,
} from '../../domain/policies/analytics-metrics.policy';
import {
  addUtcDays,
  analyticsDate,
  dateKeyFromUtcDate,
  parseAnalyticsDate,
} from '../../domain/value-objects/analytics-time';

interface ResolvedRange {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
  timeZone: string;
}

interface MutableAnalyticsTotals {
  views: number;
  uniqueReaders: number;
  readingStarts: number;
  completions: number;
  readingSeconds: number;
}

@Injectable()
export class PrismaAuthorAnalyticsReader implements AuthorAnalyticsReaderPort {
  private readonly analytics: AnalyticsConfig;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.analytics = config.getOrThrow<AnalyticsConfig>('analytics');
  }

  async overview(userId: string | undefined, from?: string, to?: string) {
    const authorId = await this.requireAuthor(userId);
    const range = this.resolveRange(from, to);
    const rows = await this.prisma.storyDailyStat.findMany({
      where: {
        date: { gte: range.from, lte: range.to },
        story: { is: { authorId, deletedAt: null } },
      },
      select: {
        date: true,
        viewCount: true,
        uniqueReaders: true,
        readingStartCount: true,
        completionCount: true,
        readingSeconds: true,
        updatedAt: true,
      },
      orderBy: { date: 'asc' },
    });
    const totals = this.sumRows(rows);
    const byDate = new Map<string, MutableAnalyticsTotals>();
    for (const row of rows) {
      const key = dateKeyFromUtcDate(row.date);
      const current = byDate.get(key) ?? this.emptyTotals();
      current.views += safeBigInt(row.viewCount);
      current.uniqueReaders += row.uniqueReaders;
      current.readingStarts += row.readingStartCount;
      current.completions += row.completionCount;
      current.readingSeconds += safeBigInt(row.readingSeconds);
      byDate.set(key, current);
    }
    return {
      range: { from: range.fromKey, to: range.toKey, timeZone: range.timeZone },
      totals: this.withRate(totals),
      series: [...byDate.entries()].map(([date, value]) => ({
        date,
        ...this.withRate(value),
      })),
      dataAvailability: this.dataAvailability(range, rows),
      freshness: 'Dữ liệu có thể chậm vài phút.',
    };
  }

  async stories(
    userId: string | undefined,
    input: { from?: string; to?: string; page: number; pageSize: number },
  ) {
    const authorId = await this.requireAuthor(userId);
    const range = this.resolveRange(input.from, input.to);
    const [stories, totalItems] = await Promise.all([
      this.prisma.story.findMany({
        where: { authorId, deletedAt: null },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: { id: true, title: true, slug: true },
      }),
      this.prisma.story.count({ where: { authorId, deletedAt: null } }),
    ]);
    const ids = stories.map((story) => story.id);
    const stats = ids.length
      ? await this.prisma.storyDailyStat.findMany({
          where: {
            storyId: { in: ids },
            date: { gte: range.from, lte: range.to },
          },
          select: {
            storyId: true,
            date: true,
            viewCount: true,
            uniqueReaders: true,
            readingStartCount: true,
            completionCount: true,
            readingSeconds: true,
            updatedAt: true,
          },
        })
      : [];
    const totalsByStory = new Map<string, MutableAnalyticsTotals>();
    const datesByStory = new Map<string, Set<string>>();
    const latestUpdateByStory = new Map<string, Date>();
    for (const row of stats) {
      const current = totalsByStory.get(row.storyId) ?? this.emptyTotals();
      current.views += safeBigInt(row.viewCount);
      current.uniqueReaders += row.uniqueReaders;
      current.readingStarts += row.readingStartCount;
      current.completions += row.completionCount;
      current.readingSeconds += safeBigInt(row.readingSeconds);
      totalsByStory.set(row.storyId, current);
      const dates = datesByStory.get(row.storyId) ?? new Set<string>();
      dates.add(dateKeyFromUtcDate(row.date));
      datesByStory.set(row.storyId, dates);
      const latest = latestUpdateByStory.get(row.storyId);
      if (!latest || row.updatedAt > latest) {
        latestUpdateByStory.set(row.storyId, row.updatedAt);
      }
    }
    return {
      range: { from: range.fromKey, to: range.toKey, timeZone: range.timeZone },
      items: stories.map((story) => ({
        ...story,
        ...this.withRate(totalsByStory.get(story.id) ?? this.emptyTotals()),
        recordedDays: datesByStory.get(story.id)?.size ?? 0,
        lastAggregatedAt:
          latestUpdateByStory.get(story.id)?.toISOString() ?? null,
      })),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async story(
    userId: string | undefined,
    storyId: string,
    from?: string,
    to?: string,
  ) {
    const authorId = await this.requireAuthor(userId);
    const range = this.resolveRange(from, to);
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, authorId, deletedAt: null },
      select: { id: true, title: true, slug: true },
    });
    if (!story) {
      throw new ResourceNotFoundException({
        code: 'AUTHOR_ANALYTICS_STORY_NOT_FOUND',
        resource: 'story analytics',
        identifier: storyId,
      });
    }
    const [daily, chapters] = await Promise.all([
      this.prisma.storyDailyStat.findMany({
        where: { storyId, date: { gte: range.from, lte: range.to } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          viewCount: true,
          uniqueReaders: true,
          readingStartCount: true,
          completionCount: true,
          readingSeconds: true,
          updatedAt: true,
        },
      }),
      this.prisma.chapter.findMany({
        where: { storyId, deletedAt: null },
        orderBy: [{ number: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          number: true,
          title: true,
          dailyStats: {
            where: { date: { gte: range.from, lte: range.to } },
            select: {
              viewCount: true,
              uniqueReaders: true,
              readingStartCount: true,
              completionCount: true,
              readingSeconds: true,
            },
          },
        },
      }),
    ]);
    const totals = this.sumRows(daily);
    const byDate = new Map(
      daily.map((row) => [
        dateKeyFromUtcDate(row.date),
        this.withRate({
          views: safeBigInt(row.viewCount),
          uniqueReaders: row.uniqueReaders,
          readingStarts: row.readingStartCount,
          completions: row.completionCount,
          readingSeconds: safeBigInt(row.readingSeconds),
        }),
      ]),
    );
    return {
      story,
      range: { from: range.fromKey, to: range.toKey, timeZone: range.timeZone },
      totals: this.withRate(totals),
      series: [...byDate.entries()].map(([date, value]) => ({
        date,
        ...value,
      })),
      dataAvailability: this.dataAvailability(range, daily),
      chapters: chapters.map((chapter) => {
        const chapterTotals = chapter.dailyStats.reduce((sum, row) => {
          sum.views += safeBigInt(row.viewCount);
          sum.uniqueReaders += row.uniqueReaders;
          sum.readingStarts += row.readingStartCount;
          sum.completions += row.completionCount;
          sum.readingSeconds += safeBigInt(row.readingSeconds);
          return sum;
        }, this.emptyTotals());
        return {
          id: chapter.id,
          number: Number(chapter.number),
          title: chapter.title,
          ...this.withRate(chapterTotals),
        };
      }),
    };
  }

  private async requireAuthor(userId: string | undefined): Promise<string> {
    if (!userId) throw new AuthenticationRequiredException();
    const author = await this.prisma.authorProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!author) {
      throw new ResourceNotFoundException({
        code: 'AUTHOR_PROFILE_NOT_FOUND',
        resource: 'hồ sơ tác giả',
      });
    }
    return author.userId;
  }

  private resolveRange(from?: string, to?: string): ResolvedRange {
    const today = analyticsDate(new Date(), this.analytics.timeZone);
    const toDate = to ? this.strictDate(to) : today;
    const fromDate = from ? this.strictDate(from) : addUtcDays(toDate, -29);
    const days =
      Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > 365) {
      throw new InvalidInputException({
        code: 'ANALYTICS_INVALID_DATE_RANGE',
        message: 'Khoảng analytics phải từ 1 đến 365 ngày',
      });
    }
    return {
      from: fromDate,
      to: toDate,
      fromKey: dateKeyFromUtcDate(fromDate),
      toKey: dateKeyFromUtcDate(toDate),
      timeZone: this.analytics.timeZone,
    };
  }

  private strictDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return this.invalidRange();
    const date = parseAnalyticsDate(value);
    if (dateKeyFromUtcDate(date) !== value) return this.invalidRange();
    return date;
  }

  private invalidRange(): never {
    throw new InvalidInputException({
      code: 'ANALYTICS_INVALID_DATE_RANGE',
      message: 'Ngày analytics không hợp lệ',
    });
  }

  private emptyTotals() {
    return {
      views: 0,
      uniqueReaders: 0,
      readingStarts: 0,
      completions: 0,
      readingSeconds: 0,
    };
  }

  private withRate<T extends MutableAnalyticsTotals>(value: T) {
    return {
      ...value,
      ...derivedAnalyticsMetrics(value),
    };
  }

  private sumRows(
    rows: readonly {
      viewCount: bigint;
      uniqueReaders: number;
      readingStartCount: number;
      completionCount: number;
      readingSeconds: bigint;
    }[],
  ) {
    return rows.reduce((sum, row) => {
      sum.views += safeBigInt(row.viewCount);
      sum.uniqueReaders += row.uniqueReaders;
      sum.readingStarts += row.readingStartCount;
      sum.completions += row.completionCount;
      sum.readingSeconds += safeBigInt(row.readingSeconds);
      return sum;
    }, this.emptyTotals());
  }

  private dateKeys(range: ResolvedRange): string[] {
    const keys: string[] = [];
    for (
      let current = range.from;
      current <= range.to;
      current = addUtcDays(current, 1)
    ) {
      keys.push(dateKeyFromUtcDate(current));
    }
    return keys;
  }

  private dataAvailability(
    range: ResolvedRange,
    rows: readonly { date: Date; updatedAt: Date }[],
  ) {
    const requestedDays = this.dateKeys(range).length;
    const dates = new Set(rows.map((row) => dateKeyFromUtcDate(row.date)));
    const lastAggregatedAt = rows.reduce<Date | null>(
      (latest, row) =>
        !latest || row.updatedAt > latest ? row.updatedAt : latest,
      null,
    );
    return {
      requestedDays,
      recordedDays: dates.size,
      unrecordedDays: requestedDays - dates.size,
      lastAggregatedAt: lastAggregatedAt?.toISOString() ?? null,
      seriesMode: 'recorded_days_only' as const,
      audienceMetric: 'sum_of_story_daily_unique_readers' as const,
    };
  }
}
