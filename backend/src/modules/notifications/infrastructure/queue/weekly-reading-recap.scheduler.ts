import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AnalyticsConfig, MailConfig } from '@/config';
import { AccountStatus, Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { MailTemplateId } from '@/infrastructure/mail/templates';
import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';
import { OutboxWriterService } from '@/infrastructure/queue/outbox';
import { dateKeyInTimeZone } from '@/modules/reading-history';

const RECIPIENT_BATCH_SIZE = 200;
const SCHEDULER_INTERVAL_MS = 60 * 60_000;
const RECAP_EXPIRY_DAYS = 35;

export const WEEKLY_RECAP_IN_APP_PREFERENCE = 'weeklyRecapInApp';
export const WEEKLY_RECAP_EMAIL_PREFERENCE = 'weeklyRecapEmail';
export const WEEKLY_RECAP_IN_APP_ENABLED_AT = 'weeklyRecapInAppEnabledAt';
export const WEEKLY_RECAP_EMAIL_ENABLED_AT = 'weeklyRecapEmailEnabledAt';

interface ClosedWeek {
  readonly startDate: string;
  readonly endDate: string;
}

interface WeeklySummary {
  readonly readingMinutes: number;
  readonly chaptersCompleted: number;
  readonly activeDays: number;
}

interface WeeklySummaryRow {
  readonly userId: string;
  readonly readingSeconds: bigint;
  readonly chaptersCompleted: number;
  readonly activeDays: number;
}

const SUBSCRIBER_SELECT = {
  userId: true,
  emailEnabled: true,
  inAppEnabled: true,
  preferences: true,
  user: {
    select: {
      email: true,
      displayName: true,
      emailVerifiedAt: true,
    },
  },
} satisfies Prisma.NotificationPreferenceSelect;

type Subscriber = Prisma.NotificationPreferenceGetPayload<{
  select: typeof SUBSCRIBER_SELECT;
}>;

@Injectable()
export class WeeklyReadingRecapScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WeeklyReadingRecapScheduler.name);
  private readonly analytics: AnalyticsConfig;
  private readonly mail: MailConfig;
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastProcessedWeekStart?: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly outboxWriter: OutboxWriterService,
  ) {
    this.analytics = config.getOrThrow<AnalyticsConfig>('analytics');
    this.mail = config.getOrThrow<MailConfig>('mail');
  }

  onModuleInit(): void {
    if (!this.analytics.enabled) return;
    this.timer = setInterval(() => this.runTick(), SCHEDULER_INTERVAL_MS);
    this.timer.unref?.();
    this.runTick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running || !this.analytics.enabled) return;
    this.running = true;

    try {
      const week = previousClosedWeek(now, this.analytics.timeZone);
      if (this.lastProcessedWeekStart === week.startDate) return;
      let cursorUserId: string | undefined;
      let subscriberCount = 0;
      let notificationCount = 0;
      let emailCount = 0;

      while (true) {
        const subscribers = await this.findSubscriberBatch(cursorUserId);
        if (subscribers.length === 0) break;
        cursorUserId = subscribers[subscribers.length - 1]?.userId;
        subscriberCount += subscribers.length;

        const summaries = await this.loadSummaries(
          subscribers.map(({ userId }) => userId),
          week,
        );

        for (const subscriber of subscribers) {
          const delivered = await this.deliver(
            subscriber,
            summaries.get(subscriber.userId) ?? emptySummary(),
            week,
            now,
          );
          notificationCount += delivered.notification ? 1 : 0;
          emailCount += delivered.email ? 1 : 0;
        }

        if (subscribers.length < RECIPIENT_BATCH_SIZE) break;
      }

      this.logger.log({
        event: 'weekly-reading-recap.completed',
        weekStart: week.startDate,
        weekEnd: week.endDate,
        subscribers: subscriberCount,
        notificationsQueued: notificationCount,
        emailsQueued: emailCount,
      });
      this.lastProcessedWeekStart = week.startDate;
    } finally {
      this.running = false;
    }
  }

  private runTick(): void {
    void this.tick().catch((error: unknown) => {
      this.logger.error({
        event: 'weekly-reading-recap.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    });
  }

  private findSubscriberBatch(cursorUserId?: string) {
    return this.prisma.notificationPreference.findMany({
      where: {
        user: { status: AccountStatus.ACTIVE, deletedAt: null },
        OR: [
          {
            inAppEnabled: true,
            preferences: {
              path: [WEEKLY_RECAP_IN_APP_PREFERENCE],
              equals: true,
            },
          },
          {
            emailEnabled: true,
            preferences: {
              path: [WEEKLY_RECAP_EMAIL_PREFERENCE],
              equals: true,
            },
          },
        ],
      },
      ...(cursorUserId ? { cursor: { userId: cursorUserId }, skip: 1 } : {}),
      orderBy: { userId: 'asc' },
      take: RECIPIENT_BATCH_SIZE,
      select: SUBSCRIBER_SELECT,
    });
  }

  private async loadSummaries(
    userIds: readonly string[],
    week: ClosedWeek,
  ): Promise<ReadonlyMap<string, WeeklySummary>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<WeeklySummaryRow[]>(Prisma.sql`
      SELECT
        "user_id" AS "userId",
        SUM(COALESCE("duration_seconds", 0))::bigint AS "readingSeconds",
        COUNT(DISTINCT "chapter_id") FILTER (WHERE "completed")::integer
          AS "chaptersCompleted",
        COUNT(DISTINCT (
          COALESCE("ended_at", "started_at") AT TIME ZONE ${this.analytics.timeZone}
        )::date)::integer AS "activeDays"
      FROM "reading_sessions"
      WHERE "user_id"::text IN (${Prisma.join(userIds)})
        AND (
          COALESCE("ended_at", "started_at") AT TIME ZONE ${this.analytics.timeZone}
        )::date BETWEEN ${week.startDate}::date AND ${week.endDate}::date
        AND (COALESCE("duration_seconds", 0) > 0 OR "completed")
      GROUP BY "user_id"
    `);

    return new Map(
      rows.map((row) => [
        row.userId,
        {
          readingMinutes: Math.round(
            Math.max(0, Number(row.readingSeconds)) / 60,
          ),
          chaptersCompleted: Math.max(0, row.chaptersCompleted),
          activeDays: Math.max(0, row.activeDays),
        },
      ]),
    );
  }

  private async deliver(
    subscriber: Subscriber,
    summary: WeeklySummary,
    week: ClosedWeek,
    now: Date,
  ): Promise<{ notification: boolean; email: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${`weekly-reading-recap-preference:${subscriber.userId}`})
        )
      `);
      const current = await tx.notificationPreference.findFirst({
        where: {
          userId: subscriber.userId,
          user: { status: AccountStatus.ACTIVE, deletedAt: null },
        },
        select: SUBSCRIBER_SELECT,
      });
      if (!current) return { notification: false, email: false };

      const preferences = asRecord(current.preferences);
      const wantsNotification =
        current.inAppEnabled &&
        preferences[WEEKLY_RECAP_IN_APP_PREFERENCE] === true &&
        enabledBeforeWeekClosed(
          preferences[WEEKLY_RECAP_IN_APP_ENABLED_AT],
          week.endDate,
          this.analytics.timeZone,
        );
      const wantsEmail =
        this.mail.enabled &&
        current.emailEnabled &&
        current.user.emailVerifiedAt !== null &&
        preferences[WEEKLY_RECAP_EMAIL_PREFERENCE] === true &&
        enabledBeforeWeekClosed(
          preferences[WEEKLY_RECAP_EMAIL_ENABLED_AT],
          week.endDate,
          this.analytics.timeZone,
        );
      if (!wantsNotification && !wantsEmail) {
        return { notification: false, email: false };
      }

      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${`weekly-reading-recap:${week.startDate}:${subscriber.userId}`})
        )
      `);

      let notification = false;
      let email = false;

      if (wantsNotification) {
        const dedupeKey = `weekly-reading-recap:${week.startDate}:${subscriber.userId}`;
        const existing = await tx.notification.findUnique({
          where: { dedupeKey },
          select: { id: true },
        });
        if (!existing) {
          await tx.notification.create({
            data: {
              dedupeKey,
              userId: current.userId,
              type: 'weekly_reading_recap',
              title: 'Tổng kết đọc tuần của bạn',
              body: recapMessage(summary),
              data: {
                category: 'account',
                tag: 'Tổng kết tuần',
                route: ['/tai-khoan', 'lich-su'],
                weekStart: week.startDate,
                weekEnd: week.endDate,
                ...summary,
              },
              expiresAt: new Date(
                now.getTime() + RECAP_EXPIRY_DAYS * 24 * 60 * 60_000,
              ),
            },
          });
          notification = true;
        }
      }

      if (wantsEmail) {
        const idempotencyKey = `weekly-reading-recap:email:${week.startDate}:${subscriber.userId}`;
        const existing = await tx.outboxEvent.findUnique({
          where: { idempotencyKey },
          select: { id: true },
        });
        if (!existing) {
          await this.outboxWriter.create(tx, {
            aggregateType: 'mail',
            aggregateId: subscriber.userId,
            eventType: SEND_MAIL_JOB,
            idempotencyKey,
            causationId: idempotencyKey,
            payload: {
              version: 1,
              templateId: MailTemplateId.WEEKLY_READING_RECAP,
              recipientEmail: current.user.email,
              variables: {
                displayName: current.user.displayName,
                weekStart: week.startDate,
                weekEnd: week.endDate,
                ...summary,
                recapUrl: new URL(
                  '/tai-khoan/lich-su',
                  this.mail.frontendPublicUrl,
                ).toString(),
              },
              correlationId: idempotencyKey,
            },
          });
          email = true;
        }
      }

      return { notification, email };
    });
  }
}

export function previousClosedWeek(now: Date, timeZone: string): ClosedWeek {
  const today = parseDateKey(dateKeyInTimeZone(now, timeZone));
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const currentWeekStart = addDays(today, -daysSinceMonday);
  const end = addDays(currentWeekStart, -1);
  const start = addDays(end, -6);
  return { startDate: dateKey(start), endDate: dateKey(end) };
}

function enabledBeforeWeekClosed(
  value: unknown,
  weekEnd: string,
  timeZone: string,
): boolean {
  if (typeof value !== 'string') return false;
  const enabledAt = new Date(value);
  return (
    !Number.isNaN(enabledAt.getTime()) &&
    dateKeyInTimeZone(enabledAt, timeZone) <= weekEnd
  );
}

function recapMessage(summary: WeeklySummary): string {
  if (
    summary.readingMinutes === 0 &&
    summary.chaptersCompleted === 0 &&
    summary.activeDays === 0
  ) {
    return 'Tuần qua bạn chưa có phiên đọc nào được ghi nhận. Bắt đầu một chương mới nhé!';
  }
  return `Tuần qua bạn đã đọc ${formatMinutes(summary.readingMinutes)} trong ${summary.activeDays} ngày và hoàn thành ${summary.chaptersCompleted} chương.`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours} giờ` : `${hours} giờ ${remaining} phút`;
}

function emptySummary(): WeeklySummary {
  return { readingMinutes: 0, chaptersCompleted: 0, activeDays: 0 };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
