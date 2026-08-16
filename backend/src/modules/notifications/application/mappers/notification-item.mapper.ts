import type { NotificationItemDto } from '../dto';
import type { NotificationRecord } from '../ports';

export class NotificationItemMapper {
  static toDto(
    notification: NotificationRecord,
    now: Date,
  ): NotificationItemDto {
    const data = NotificationItemMapper.asRecord(notification.data);
    const type = NotificationItemMapper.normalizeType(notification.type);
    const category = NotificationItemMapper.normalizeCategory(
      data['category'],
      type,
    );
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
      createdAt: NotificationItemMapper.formatRelativeTime(createdAtMinutes),
      createdAtMinutes,
      tag:
        NotificationItemMapper.stringValue(data['tag']) ??
        NotificationItemMapper.defaultTag(category),
      route: NotificationItemMapper.routeValue(data['route']),
      isRead: notification.readAt !== null,
      isSaved: data['saved'] === true,
    };
  }

  private static normalizeType(type: string): NotificationItemDto['type'] {
    const normalized = type.toLocaleLowerCase('en');

    if (normalized.includes('chapter')) return 'chapter';
    if (normalized.includes('comment') || normalized.includes('reply'))
      return 'comment';
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

  private static normalizeCategory(
    value: unknown,
    type: NotificationItemDto['type'],
  ): NotificationItemDto['category'] {
    if (
      value === 'story' ||
      value === 'account' ||
      value === 'system' ||
      value === 'promotion'
    ) {
      return value;
    }

    if (type === 'chapter' || type === 'following') return 'story';
    if (type === 'comment' || type === 'achievement') return 'account';
    if (type === 'promotion') return 'promotion';

    return 'system';
  }

  private static defaultTag(category: NotificationItemDto['category']): string {
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

  private static routeValue(value: unknown): readonly (string | number)[] {
    if (!Array.isArray(value)) {
      return ['/thong-bao'];
    }

    const route = value.filter(
      (segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number',
    );

    return route.length > 0 ? route : ['/thong-bao'];
  }

  private static formatRelativeTime(minutes: number): string {
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

  private static asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private static stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
