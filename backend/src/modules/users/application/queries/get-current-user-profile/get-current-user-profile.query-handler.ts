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
    UserProfileResultDto,
} from '../../dto';

import {
    UserProfileResultMapper,
} from '../../mappers';

import {
    GetCurrentUserProfileQuery,
} from './get-current-user-profile.query';

@Injectable()
export class GetCurrentUserProfileQueryHandler {
    constructor(
        @Inject(USER_PROFILE_REPOSITORY)
        private readonly repository:
            UserProfileRepository,
    ) { }

    async execute(
        query: GetCurrentUserProfileQuery,
    ): Promise<UserProfileResultDto> {
        if (
            !query.userId ||
            !isUuidV4(query.userId)
        ) {
            throw new AuthenticationRequiredException({
                code: 'USER_AUTHENTICATION_REQUIRED',
                message: 'Bạn cần đăng nhập để xem hồ sơ',
            });
        }

        const profile =
            await this.repository.findProfileByUserId(
                query.userId,
            );

        if (!profile) {
            throw new UserProfileUnavailableException();
        }

        return UserProfileResultMapper.toDto(
            profile,
        );
    }
}