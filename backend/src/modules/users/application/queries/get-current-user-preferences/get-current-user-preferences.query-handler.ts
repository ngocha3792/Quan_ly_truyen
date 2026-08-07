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
    UserProfileUnavailableException,
} from '../../../domain';

import {
    USER_PROFILE_READER_PORT,
    type UserProfileReaderPort,
} from '../../ports';

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
        @Inject(USER_PROFILE_READER_PORT)
        private readonly reader:
            UserProfileReaderPort,
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
            await this.reader.findPreferencesByUserId(
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
