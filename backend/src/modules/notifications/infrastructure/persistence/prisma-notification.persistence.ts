import { Injectable } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

import type {
  NotificationPersistencePort,
  NotificationPreferenceRecord,
  NotificationRecord,
  UpsertPreferenceInput,
} from '../../application/ports';

@Injectable()
export class PrismaNotificationPersistence implements NotificationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByUser(
    userId: string,
    now: Date,
    limit: number,
  ): Promise<readonly NotificationRecord[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async countByUser(userId: string, now: Date): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }

  async countUnreadByUser(userId: string, now: Date): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }

  async countTodayByUser(
    userId: string,
    from: Date,
    now: Date,
  ): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        createdAt: { gte: from },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }

  async findPreference(
    userId: string,
  ): Promise<NotificationPreferenceRecord | null> {
    return this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
  }

  async findOneByUser(
    userId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null> {
    return this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
  }

  async setReadAt(notificationId: string, readAt: Date | null): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt },
    });
  }

  async updateData(
    notificationId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { data: data as Prisma.InputJsonObject },
    });
  }

  async markAllRead(userId: string, now: Date): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { readAt: now },
    });
  }

  async upsertPreference(
    input: UpsertPreferenceInput,
  ): Promise<NotificationPreferenceRecord> {
    const { userId, newChapters, comments, system, promotions } = input;

    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    const existingPreferences = this.toInputJsonObject(existing?.preferences);

    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        newChapterEnabled: newChapters ?? true,
        commentReplyEnabled: comments ?? true,
        moderationEnabled: system ?? true,
        preferences: {
          ...existingPreferences,
          promotionsEnabled: promotions ?? true,
        },
      },
      update: {
        ...(newChapters === undefined
          ? {}
          : { newChapterEnabled: newChapters }),
        ...(comments === undefined ? {} : { commentReplyEnabled: comments }),
        ...(system === undefined ? {} : { moderationEnabled: system }),
        ...(promotions === undefined
          ? {}
          : {
              preferences: {
                ...existingPreferences,
                promotionsEnabled: promotions,
              },
            }),
      },
    });
  }

  private toInputJsonObject(value: unknown): Prisma.InputJsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
