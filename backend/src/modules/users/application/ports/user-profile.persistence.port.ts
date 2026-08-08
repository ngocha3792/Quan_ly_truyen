import type { UserPreferencesEntity, UserProfileEntity } from '../../domain';

export const USER_PROFILE_PERSISTENCE_PORT = Symbol(
  'USER_PROFILE_PERSISTENCE_PORT',
);

export interface UserRequestAuditContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface UpdateUserProfilePersistenceInput {
  readonly userId: string;
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly avatarMediaId?: string | null;
  readonly changedAt: Date;
  readonly audit: UserRequestAuditContext;
}

export type UpdateUserProfilePersistenceResult =
  | {
      readonly status: 'updated';
      readonly profile: UserProfileEntity;
    }
  | {
      readonly status: 'user_not_found';
    }
  | {
      readonly status: 'invalid_avatar';
    };

export interface UpdateUserPreferencesPersistenceInput {
  readonly userId: string;
  readonly newChapterNotifications?: boolean;
  readonly showRecentActivity?: boolean;
  readonly allowUpdateEmails?: boolean;
  readonly changedAt: Date;
  readonly audit: UserRequestAuditContext;
}

export type UpdateUserPreferencesPersistenceResult =
  | {
      readonly status: 'updated';
      readonly preferences: UserPreferencesEntity;
    }
  | {
      readonly status: 'user_not_found';
    };

export interface UserProfilePersistencePort {
  updateProfile(
    input: UpdateUserProfilePersistenceInput,
  ): Promise<UpdateUserProfilePersistenceResult>;

  updatePreferences(
    input: UpdateUserPreferencesPersistenceInput,
  ): Promise<UpdateUserPreferencesPersistenceResult>;
}
