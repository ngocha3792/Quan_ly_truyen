export interface NotificationItemDto {
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

export interface NotificationStatisticsDto {
  readonly total: number;
  readonly unread: number;
  readonly saved: number;
  readonly receivedToday: number;
}

export interface NotificationSettingsDto {
  readonly newChapters: boolean;
  readonly comments: boolean;
  readonly system: boolean;
  readonly promotions: boolean;
}

export interface NotificationRecentActivityDto {
  readonly id: string;
  readonly time: string;
  readonly description: string;
}

export interface NotificationViewDto {
  readonly notifications: readonly NotificationItemDto[];
  readonly statistics: NotificationStatisticsDto;
  readonly settings: NotificationSettingsDto;
  readonly recentActivities: readonly NotificationRecentActivityDto[];
}
