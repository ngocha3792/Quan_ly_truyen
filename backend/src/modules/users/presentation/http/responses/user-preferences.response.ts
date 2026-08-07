import type {
    UserPreferencesResultDto,
} from '../../../application';

export interface UserPreferencesResponse {
    readonly newChapterNotifications: boolean;

    readonly showRecentActivity: boolean;

    readonly allowUpdateEmails: boolean;

    readonly updatedAt: string | null;
}

export function toUserPreferencesResponse(
    result:
        UserPreferencesResultDto,
): UserPreferencesResponse {
    return {
        newChapterNotifications:
            result.newChapterNotifications,

        showRecentActivity:
            result.showRecentActivity,

        allowUpdateEmails:
            result.allowUpdateEmails,

        updatedAt:
            result.updatedAt?.toISOString() ??
            null,
    };
}