export type NotificationCategory = 'all' | 'unread' | 'story' | 'account' | 'system' | 'promotion';

export type NotificationType =
  | 'chapter'
  | 'comment'
  | 'author'
  | 'promotion'
  | 'security'
  | 'following'
  | 'community'
  | 'achievement';

export type NotificationSettingKey = 'newChapters' | 'comments' | 'system' | 'promotions';

export interface UserNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly category: Exclude<NotificationCategory, 'all' | 'unread'>;

  readonly title: string;
  readonly message: string;
  readonly createdAt: string;
  readonly createdAtMinutes: number;

  readonly tag: string;
  readonly route: readonly (string | number)[];

  readonly isRead: boolean;
  readonly isSaved: boolean;
}

export interface NotificationStatistics {
  readonly total: number;
  readonly unread: number;
  readonly saved: number;
  readonly receivedToday: number;
}

export interface NotificationSettings {
  readonly newChapters: boolean;
  readonly comments: boolean;
  readonly system: boolean;
  readonly promotions: boolean;
}

export interface NotificationActivity {
  readonly id: string;
  readonly time: string;
  readonly description: string;
}

export interface NotificationsView {
  readonly notifications: readonly UserNotification[];
  readonly statistics: NotificationStatistics;
  readonly settings: NotificationSettings;
  readonly recentActivities: readonly NotificationActivity[];
}
