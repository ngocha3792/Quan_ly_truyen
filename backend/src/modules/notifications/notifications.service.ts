import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

export interface NotificationsViewResponse {
  readonly notifications: readonly NotificationItemResponse[];
  readonly statistics: {
    readonly total: number;
    readonly unread: number;
    readonly saved: number;
    readonly receivedToday: number;
  };
  readonly settings: NotificationSettingsResponse;
  readonly recentActivities: readonly {
    readonly id: string;
    readonly time: string;
    readonly description: string;
  }[];
}

export interface NotificationSettingsResponse {
  readonly newChapters: boolean;
  readonly comments: boolean;
  readonly system: boolean;
  readonly promotions: boolean;
}

interface NotificationItemResponse {
  readonly id: string;
  readonly type:
    | 'chapter'
    | 'comment'
    | 'author'
    | 'promotion'
    | 'security'
    | 'following'
    | 'community'
    | 'achievement';
  readonly category: 'story' | 'account' | 'system' | 'promotion';
  readonly title: string;
  readonly message: string;
  readonly createdAt: string;
  readonly createdAtMinutes: number;
  readonly tag: string;
  readonly route: readonly (string | number)[];
  readonly isRead: boolean;
  readonly isSaved: boolean;
}

export interface UpdateNotificationSettingsInput {
  readonly newChapters?: boolean;
  readonly comments?: boolean;
  readonly system?: boolean;
  readonly promotions?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getView(userId: string | undefined): Promise<NotificationsViewResponse> {
    const authenticatedUserId = this.requireUserId(userId);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [notifications, total, unread, receivedToday, preference] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId: authenticatedUserId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.notification.count({
        where: {
          userId: authenticatedUserId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.notification.count({
        where: {
          userId: authenticatedUserId,
          readAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.notification.count({
        where: {
          userId: authenticatedUserId,
          createdAt: { gte: startOfToday },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.notificationPreference.findUnique({
        where: { userId: authenticatedUserId },
      }),
    ]);

    const items = notifications.map((notification) => this.toItem(notification, now));

    return {
      notifications: items,
      statistics: {
        total,
        unread,
        saved: items.filter((item) => item.isSaved).length,
        receivedToday,
      },
      settings: this.toSettings(preference),
      recentActivities: items.slice(0, 3).map((item) => ({
        id: `activity-${item.id}`,
        time: item.createdAt,
        description: item.title,
      })),
    };
  }

  async setRead(
    userId: string | undefined,
    notificationId: string,
    isRead: boolean,
  ): Promise<void> {
    const authenticatedUserId = this.requireUserId(userId);
    await this.ensureOwnedNotification(authenticatedUserId, notificationId);

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: isRead ? new Date() : null },
    });
  }

  async setSaved(
    userId: string | undefined,
    notificationId: string,
    isSaved: boolean,
  ): Promise<void> {
    const authenticatedUserId = this.requireUserId(userId);
    const notification = await this.ensureOwnedNotification(authenticatedUserId, notificationId);
    const data = this.toInputJsonObject(notification.data);

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        data: {
          ...data,
          saved: isSaved,
        },
      },
    });
  }

  async markAllAsRead(userId: string | undefined): Promise<void> {
    const authenticatedUserId = this.requireUserId(userId);

    await this.prisma.notification.updateMany({
      where: {
        userId: authenticatedUserId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: { readAt: new Date() },
    });
  }

  async updateSettings(
    userId: string | undefined,
    input: UpdateNotificationSettingsInput,
  ): Promise<NotificationSettingsResponse> {
    const authenticatedUserId = this.requireUserId(userId);
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId: authenticatedUserId },
    });
    const existingPreferences = this.toInputJsonObject(existing?.preferences);

    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId: authenticatedUserId },
      create: {
        userId: authenticatedUserId,
        newChapterEnabled: input.newChapters ?? true,
        commentReplyEnabled: input.comments ?? true,
        moderationEnabled: input.system ?? true,
        preferences: {
          ...existingPreferences,
          promotionsEnabled: input.promotions ?? true,
        },
      },
      update: {
        ...(input.newChapters === undefined
          ? {}
          : { newChapterEnabled: input.newChapters }),
        ...(input.comments === undefined
          ? {}
          : { commentReplyEnabled: input.comments }),
        ...(input.system === undefined ? {} : { moderationEnabled: input.system }),
        ...(input.promotions === undefined
          ? {}
          : {
              preferences: {
                ...existingPreferences,
                promotionsEnabled: input.promotions,
              },
            }),
      },
    });

    return this.toSettings(preference);
  }

  private async ensureOwnedNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private toItem(
    notification: {
      readonly id: string;
      readonly type: string;
      readonly title: string;
      readonly body: string;
      readonly data: unknown;
      readonly readAt: Date | null;
      readonly createdAt: Date;
    },
    now: Date,
  ): NotificationItemResponse {
    const data = this.asRecord(notification.data);
    const type = this.normalizeType(notification.type);
    const category = this.normalizeCategory(data['category'], type);
    const createdAtMinutes = Math.max(
      0,
      Math.floor((now.getTime() - notification.createdAt.getTime()) / 60_000),
    );

    return {
      id: notification.id,
      type,
      category,
      title: notification.title,
      message: notification.body,
      createdAt: this.formatRelativeTime(createdAtMinutes),
      createdAtMinutes,
      tag: this.stringValue(data['tag']) ?? this.defaultTag(category),
      route: this.routeValue(data['route']),
      isRead: notification.readAt !== null,
      isSaved: data['saved'] === true,
    };
  }

  private toSettings(
    preference:
      | {
          readonly newChapterEnabled: boolean;
          readonly commentReplyEnabled: boolean;
          readonly moderationEnabled: boolean;
          readonly preferences: unknown;
        }
      | null,
  ): NotificationSettingsResponse {
    const preferences = this.asRecord(preference?.preferences);

    return {
      newChapters: preference?.newChapterEnabled ?? true,
      comments: preference?.commentReplyEnabled ?? true,
      system: preference?.moderationEnabled ?? true,
      promotions:
        typeof preferences['promotionsEnabled'] === 'boolean'
          ? preferences['promotionsEnabled']
          : true,
    };
  }

  private normalizeType(type: string): NotificationItemResponse['type'] {
    const normalized = type.toLocaleLowerCase('en');

    if (normalized.includes('chapter')) return 'chapter';
    if (normalized.includes('comment') || normalized.includes('reply')) return 'comment';
    if (normalized.includes('author')) return 'author';
    if (normalized.includes('promotion')) return 'promotion';
    if (
      normalized.includes('security') ||
      normalized.includes('login') ||
      normalized.includes('password') ||
      normalized.includes('mfa')
    ) {
      return 'security';
    }
    if (normalized.includes('follow')) return 'following';
    if (normalized.includes('achievement')) return 'achievement';

    return 'community';
  }

  private normalizeCategory(
    value: unknown,
    type: NotificationItemResponse['type'],
  ): NotificationItemResponse['category'] {
    if (value === 'story' || value === 'account' || value === 'system' || value === 'promotion') {
      return value;
    }

    if (type === 'chapter' || type === 'following') return 'story';
    if (type === 'comment' || type === 'achievement') return 'account';
    if (type === 'promotion') return 'promotion';

    return 'system';
  }

  private defaultTag(category: NotificationItemResponse['category']): string {
    switch (category) {
      case 'story':
        return 'Cập nhật truyện';
      case 'account':
        return 'Tài khoản';
      case 'promotion':
        return 'Ưu đãi';
      case 'system':
      default:
        return 'Hệ thống';
    }
  }

  private routeValue(value: unknown): readonly (string | number)[] {
    if (!Array.isArray(value)) {
      return ['/thong-bao'];
    }

    const route = value.filter(
      (segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number',
    );

    return route.length > 0 ? route : ['/thong-bao'];
  }

  private formatRelativeTime(minutes: number): string {
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;

    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} tuần trước`;

    const months = Math.floor(days / 30);
    return `${Math.max(1, months)} tháng trước`;
  }

  private toInputJsonObject(value: unknown): Prisma.InputJsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return userId;
  }
}
