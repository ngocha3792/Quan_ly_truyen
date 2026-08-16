import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import {
  AccountStatus,
  AuthorLifecycleStatus,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { TracePropagationService } from '@/infrastructure/observability';
import {
  AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
  type AuthorChapterPublishedNotificationV1,
  type OutboxQueueEnvelope,
} from '@/infrastructure/queue/contracts';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';

const FANOUT_BATCH_SIZE = 500;

@Processor(QUEUE_NAMES.NOTIFICATIONS, { concurrency: getWorkerConcurrency() })
@Injectable()
export class NotificationsFanoutProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsFanoutProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly propagation: TracePropagationService,
  ) {
    super();
  }

  async process(
    job: Job<OutboxQueueEnvelope<AuthorChapterPublishedNotificationV1>>,
  ): Promise<{ inserted: number; eligible: number }> {
    return this.propagation.runWithQueueContext(
      job.data.telemetry,
      {
        requestId: job.data.outboxEventId,
        queue: QUEUE_NAMES.NOTIFICATIONS,
      },
      () => this.processInternal(job),
    );
  }

  private async processInternal(
    job: Job<OutboxQueueEnvelope<AuthorChapterPublishedNotificationV1>>,
  ): Promise<{ inserted: number; eligible: number }> {
    if (job.name !== AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT) {
      throw new UnrecoverableError(
        `Unsupported notification event: ${job.name}`,
      );
    }
    const payload = this.validatePayload(job.data.payload);
    const publishedAt = new Date(payload.publishedAt);

    const author = await this.prisma.authorProfile.findUnique({
      where: { userId: payload.authorId },
      select: {
        penName: true,
        slug: true,
        lifecycleStatus: true,
        user: { select: { status: true, deletedAt: true } },
      },
    });

    if (
      !author ||
      author.lifecycleStatus !== AuthorLifecycleStatus.ACTIVE ||
      author.user.status !== AccountStatus.ACTIVE ||
      author.user.deletedAt !== null
    ) {
      this.logger.log({
        event: 'author-follower-notification.skipped',
        chapterId: payload.chapterId,
        outboxEventId: job.data.outboxEventId,
        reason: 'author_ineligible',
      });
      return { inserted: 0, eligible: 0 };
    }

    let cursorUserId: string | undefined;
    let insertedTotal = 0;
    let eligibleTotal = 0;
    let batchNumber = 0;

    while (true) {
      const follows = await this.prisma.userFollowAuthor.findMany({
        where: {
          authorId: payload.authorId,
          createdAt: { lte: publishedAt },
          ...(cursorUserId ? { userId: { gt: cursorUserId } } : {}),
        },
        orderBy: { userId: 'asc' },
        take: FANOUT_BATCH_SIZE,
        select: {
          userId: true,
          user: {
            select: {
              status: true,
              deletedAt: true,
              notificationPreference: {
                select: { newChapterEnabled: true, inAppEnabled: true },
              },
            },
          },
        },
      });

      if (follows.length === 0) break;
      batchNumber += 1;
      cursorUserId = follows[follows.length - 1]?.userId;

      const eligible = follows.filter((follow) => {
        const preference = follow.user.notificationPreference;
        return (
          follow.userId !== payload.authorId &&
          follow.user.status === AccountStatus.ACTIVE &&
          follow.user.deletedAt === null &&
          preference?.newChapterEnabled !== false &&
          preference?.inAppEnabled !== false
        );
      });
      eligibleTotal += eligible.length;

      const result = eligible.length
        ? await this.prisma.notification.createMany({
            data: eligible.map((follow) => ({
              dedupeKey: `new-chapter:${payload.chapterId}:${follow.userId}`,
              userId: follow.userId,
              type: 'new_chapter',
              title: `${author.penName} vừa đăng chương mới`,
              body: `${payload.storyTitle} — Chương ${payload.chapterNumber}: ${payload.chapterTitle}`,
              data: {
                category: 'story',
                tag: 'Chương mới',
                authorId: payload.authorId,
                authorSlug: author.slug,
                storyId: payload.storyId,
                storySlug: payload.storySlug,
                chapterId: payload.chapterId,
                chapterNumber: payload.chapterNumber,
                route: [
                  '/truyen',
                  payload.storySlug,
                  'chuong',
                  payload.chapterNumber,
                ],
              },
            })),
            skipDuplicates: true,
          })
        : { count: 0 };
      insertedTotal += result.count;

      this.logger.log({
        event: 'author-follower-notification.batch.completed',
        outboxEventId: job.data.outboxEventId,
        chapterId: payload.chapterId,
        batchNumber,
        eligibleCount: eligible.length,
        insertedCount: result.count,
      });

      if (follows.length < FANOUT_BATCH_SIZE) break;
    }

    return { inserted: insertedTotal, eligible: eligibleTotal };
  }

  private validatePayload(
    value: unknown,
  ): AuthorChapterPublishedNotificationV1 {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new UnrecoverableError('Invalid chapter notification payload');
    }
    const item = value as Record<string, unknown>;
    const required = [
      'authorId',
      'storyId',
      'storySlug',
      'storyTitle',
      'chapterId',
      'chapterNumber',
      'chapterTitle',
      'publishedAt',
    ] as const;
    if (
      item['version'] !== 1 ||
      required.some(
        (key) => typeof item[key] !== 'string' || !String(item[key]).trim(),
      ) ||
      Number.isNaN(Date.parse(String(item['publishedAt'])))
    ) {
      throw new UnrecoverableError('Invalid chapter notification payload');
    }
    return item as unknown as AuthorChapterPublishedNotificationV1;
  }
}
