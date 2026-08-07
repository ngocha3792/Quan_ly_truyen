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
    InvalidUserAvatarException,
    USER_PROFILE_REPOSITORY,
    type UserProfileRepository,
    UserBioValueObject,
    UserDisplayNameValueObject,
    UserProfileUnavailableException,
} from '../../../domain';

import type {
    UserProfileResultDto,
} from '../../dto';

import {
    UserProfileResultMapper,
} from '../../mappers';

import {
    UpdateCurrentUserProfileCommand,
} from './update-current-user-profile.command';

@Injectable()
export class UpdateCurrentUserProfileCommandHandler {
    constructor(
        @Inject(USER_PROFILE_REPOSITORY)
        private readonly repository:
            UserProfileRepository,
    ) { }

    async execute(
        command: UpdateCurrentUserProfileCommand,
    ): Promise<UserProfileResultDto> {
        const userId =
            this.requireUserId(
                command.userId,
            );

        const displayName =
            command.displayName === undefined
                ? undefined
                : UserDisplayNameValueObject.create(
                    command.displayName,
                ).value;

        const bio =
            command.bio === undefined
                ? undefined
                : UserBioValueObject.create(
                    command.bio,
                ).value;

        if (
            command.avatarMediaId !== undefined &&
            command.avatarMediaId !== null &&
            !isUuidV4(command.avatarMediaId)
        ) {
            throw new InvalidUserAvatarException();
        }

        /*
         * PATCH {} không tạo audit event vô nghĩa.
         */
        if (
            displayName === undefined &&
            bio === undefined &&
            command.avatarMediaId === undefined
        ) {
            const current =
                await this.repository.findProfileByUserId(
                    userId,
                );

            if (!current) {
                throw new UserProfileUnavailableException();
            }

            return UserProfileResultMapper.toDto(
                current,
            );
        }

        const result =
            await this.repository.updateProfile({
                userId,

                displayName,

                bio,

                avatarMediaId:
                    command.avatarMediaId,

                changedAt:
                    new Date(),

                audit: {
                    ipAddress:
                        command.ipAddress,

                    userAgent:
                        command.userAgent,

                    requestId:
                        command.requestId,
                },
            });

        switch (result.status) {
            case 'updated':
                return UserProfileResultMapper.toDto(
                    result.profile,
                );

            case 'invalid_avatar':
                throw new InvalidUserAvatarException();

            case 'user_not_found':
            default:
                throw new UserProfileUnavailableException();
        }
    }

    private requireUserId(
        userId: string | undefined,
    ): string {
        if (
            !userId ||
            !isUuidV4(userId)
        ) {
            throw new AuthenticationRequiredException({
                code: 'USER_AUTHENTICATION_REQUIRED',
                message: 'Bạn cần đăng nhập để cập nhật hồ sơ',
            });
        }

        return userId;
    }
}