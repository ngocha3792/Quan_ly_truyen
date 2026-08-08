export interface UserPreferencesResultDto {
  readonly newChapterNotifications: boolean;

  readonly showRecentActivity: boolean;

  readonly allowUpdateEmails: boolean;

  readonly updatedAt: Date | null;
}
