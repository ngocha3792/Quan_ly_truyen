export class UserPreferencesEntity {
  constructor(
    readonly newChapterNotifications: boolean,
    readonly showRecentActivity: boolean,
    readonly allowUpdateEmails: boolean,
    readonly updatedAt: Date | null,
  ) {}

  static defaults(): UserPreferencesEntity {
    return new UserPreferencesEntity(true, true, true, null);
  }
}
