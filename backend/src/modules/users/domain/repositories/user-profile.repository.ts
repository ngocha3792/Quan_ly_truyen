import type {
    UserPreferencesEntity,
    UserProfileEntity,
} from '../entities';

export const USER_PROFILE_REPOSITORY = Symbol(
    'USER_PROFILE_REPOSITORY',
);

export interface UserRequestAuditContext {
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
}

export interface UpdateUserProfileRepositoryInput {
    readonly userId: string;

    readonly displayName?: string;

    readonly bio?: string | null;

    readonly avatarMediaId?: string | null;

    readonly changedAt: Date;

    readonly audit: UserRequestAuditContext;
}

export type UpdateUserProfileRepositoryResult =
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

export interface UpdateUserPreferencesRepositoryInput {
    readonly userId: string;

    readonly newChapterNotifications?: boolean;

    readonly showRecentActivity?: boolean;

    readonly allowUpdateEmails?: boolean;

    readonly changedAt: Date;

    readonly audit: UserRequestAuditContext;
}

export type UpdateUserPreferencesRepositoryResult =
    | {
        readonly status: 'updated';
        readonly preferences: UserPreferencesEntity;
    }
    | {
        readonly status: 'user_not_found';
    };

export interface UserProfileRepository {
    findProfileByUserId(
        userId: string,
    ): Promise<UserProfileEntity | null>;

    updateProfile(
        input: UpdateUserProfileRepositoryInput,
    ): Promise<UpdateUserProfileRepositoryResult>;

    findPreferencesByUserId(
        userId: string,
    ): Promise<UserPreferencesEntity | null>;

    updatePreferences(
        input: UpdateUserPreferencesRepositoryInput,
    ): Promise<UpdateUserPreferencesRepositoryResult>;
}