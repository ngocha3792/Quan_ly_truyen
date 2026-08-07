import type {
    UserPreferencesEntity,
} from '../../domain';

import type {
    UserPreferencesResultDto,
} from '../dto';

export class UserPreferencesResultMapper {
    static toDto(
        preferences: UserPreferencesEntity,
    ): UserPreferencesResultDto {
        return {
            newChapterNotifications:
                preferences.newChapterNotifications,

            showRecentActivity:
                preferences.showRecentActivity,

            allowUpdateEmails:
                preferences.allowUpdateEmails,

            updatedAt:
                preferences.updatedAt,
        };
    }
}