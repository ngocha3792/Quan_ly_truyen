import {
    Body,
    Controller,
    Get,
    Header,
    Patch,
} from '@nestjs/common';

import {
    ClientIp,
    CurrentUserId,
    RequestId,
    RequirePermissions,
    UserAgent,
} from '@/common/decorators';

import {
    PermissionCode,
} from '@/common/enums';

import {
    GetCurrentUserPreferencesQuery,
    GetCurrentUserPreferencesQueryHandler,
    GetCurrentUserProfileQuery,
    GetCurrentUserProfileQueryHandler,
    UpdateCurrentUserPreferencesCommand,
    UpdateCurrentUserPreferencesCommandHandler,
    UpdateCurrentUserProfileCommand,
    UpdateCurrentUserProfileCommandHandler,
} from '../../../application';

import {
    UpdateCurrentUserPreferencesRequest,
    UpdateCurrentUserProfileRequest,
} from '../requests';

import {
    type UserPreferencesResponse,
    type UserProfileResponse,
    toUserPreferencesResponse,
    toUserProfileResponse,
} from '../responses';

@Controller('users')
export class UsersController {
    constructor(
        private readonly getCurrentUserProfile:
            GetCurrentUserProfileQueryHandler,

        private readonly updateCurrentUserProfile:
            UpdateCurrentUserProfileCommandHandler,

        private readonly getCurrentUserPreferences:
            GetCurrentUserPreferencesQueryHandler,

        private readonly updateCurrentUserPreferences:
            UpdateCurrentUserPreferencesCommandHandler,
    ) { }

    @Get('me')
    @RequirePermissions(
        PermissionCode.USER_PROFILE_READ,
    )
    @Header(
        'Cache-Control',
        'private, no-store',
    )
    async getMe(
        @CurrentUserId()
        userId:
            string | undefined,
    ): Promise<UserProfileResponse> {
        const result =
            await this.getCurrentUserProfile.execute(
                new GetCurrentUserProfileQuery(
                    userId,
                ),
            );

        return toUserProfileResponse(
            result,
        );
    }

    @Patch('me')
    @RequirePermissions(
        PermissionCode.USER_PROFILE_UPDATE,
    )
    @Header(
        'Cache-Control',
        'private, no-store',
    )
    async updateMe(
        @CurrentUserId()
        userId:
            string | undefined,

        @Body()
        request:
            UpdateCurrentUserProfileRequest,

        @ClientIp()
        ipAddress:
            string | undefined,

        @UserAgent()
        userAgent:
            string | undefined,

        @RequestId()
        requestId:
            string | undefined,
    ): Promise<UserProfileResponse> {
        const result =
            await this.updateCurrentUserProfile.execute(
                new UpdateCurrentUserProfileCommand(
                    userId,

                    request.displayName,

                    request.bio,

                    request.avatarMediaId,

                    ipAddress,

                    userAgent,

                    requestId,
                ),
            );

        return toUserProfileResponse(
            result,
        );
    }

    @Get('me/preferences')
    @RequirePermissions(
        PermissionCode.USER_PROFILE_READ,
    )
    @Header(
        'Cache-Control',
        'private, no-store',
    )
    async getPreferences(
        @CurrentUserId()
        userId:
            string | undefined,
    ): Promise<UserPreferencesResponse> {
        const result =
            await this.getCurrentUserPreferences.execute(
                new GetCurrentUserPreferencesQuery(
                    userId,
                ),
            );

        return toUserPreferencesResponse(
            result,
        );
    }

    @Patch('me/preferences')
    @RequirePermissions(
        PermissionCode.USER_PROFILE_UPDATE,
    )
    @Header(
        'Cache-Control',
        'private, no-store',
    )
    async updatePreferences(
        @CurrentUserId()
        userId:
            string | undefined,

        @Body()
        request:
            UpdateCurrentUserPreferencesRequest,

        @ClientIp()
        ipAddress:
            string | undefined,

        @UserAgent()
        userAgent:
            string | undefined,

        @RequestId()
        requestId:
            string | undefined,
    ): Promise<UserPreferencesResponse> {
        const result =
            await this.updateCurrentUserPreferences.execute(
                new UpdateCurrentUserPreferencesCommand(
                    userId,

                    request.newChapterNotifications,

                    request.showRecentActivity,

                    request.allowUpdateEmails,

                    ipAddress,

                    userAgent,

                    requestId,
                ),
            );

        return toUserPreferencesResponse(
            result,
        );
    }
}