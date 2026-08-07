import {
    Inject,
    Injectable,
} from '@nestjs/common';

import {
    AuthenticationRequiredException,
} from '@/common/exceptions';

import {
    isUuidV4,
} from '@/common/utils';

import {
    USER_PROFILE_REPOSITORY,
    type UserProfileRepository,
    UserProfileUnavailableException,
} from '../../../domain';

import type {
    UserPreferencesResultDto,
} from '../../dto';

import {
    UserPreferencesResultMapper,
} from '../../mappers';

import {
    GetCurrentUserPreferencesQuery,
} from './get-current-user-preferences.query';

@Injectable()
export class GetCurrentUserPreferencesQueryHandler {
    constructor(
        @Inject(USER_PROFILE_REPOSITORY)
        private readonly repository:
            UserProfileRepository,
    ) { }

    async execute(
        query: GetCurrentUserPreferencesQuery,
    ): Promise<UserPreferencesResultDto> {
        if (
            !query.userId ||
            !isUuidV4(query.userId)
        ) {
            throw new AuthenticationRequiredException({
                code: 'USER_AUTHENTICATION_REQUIRED',
                message: 'Bạn cần đăng nhập để xem tùy chọn tài khoản',
            });
        }

        const preferences =
            await this.repository.findPreferencesByUserId(
                query.userId,
            );

        if (!preferences) {
            throw new UserProfileUnavailableException();
        }

        return UserPreferencesResultMapper.toDto(
            preferences,
        );
    }
}