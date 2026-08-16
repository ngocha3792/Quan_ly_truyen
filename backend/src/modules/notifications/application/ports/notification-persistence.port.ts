export const NOTIFICATION_PERSISTENCE_PORT = Symbol(
  'NOTIFICATION_PERSISTENCE_PORT',
);

export interface NotificationRecord {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly data: unknown;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface NotificationPreferenceRecord {
  readonly newChapterEnabled: boolean;
  readonly commentReplyEnabled: boolean;
  readonly moderationEnabled: boolean;
  readonly preferences: unknown;
}

export interface UpsertPreferenceInput {
  readonly userId: string;
  readonly newChapters?: boolean;
  readonly comments?: boolean;
  readonly system?: boolean;
  readonly promotions?: boolean;
}

export interface NotificationPersistencePort {
  findManyByUser(
    userId: string,
    now: Date,
    limit: number,
  ): Promise<readonly NotificationRecord[]>;

  countByUser(userId: string, now: Date): Promise<number>;

  countUnreadByUser(userId: string, now: Date): Promise<number>;

  countTodayByUser(userId: string, from: Date, now: Date): Promise<number>;

  findPreference(userId: string): Promise<NotificationPreferenceRecord | null>;

  findOneByUser(
    userId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null>;

  setReadAt(notificationId: string, readAt: Date | null): Promise<void>;

  updateData(
    notificationId: string,
    data: Record<string, unknown>,
  ): Promise<void>;

  markAllRead(userId: string, now: Date): Promise<void>;

  upsertPreference(
    input: UpsertPreferenceInput,
  ): Promise<NotificationPreferenceRecord>;
}
