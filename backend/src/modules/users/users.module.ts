import {
    Module,
} from '@nestjs/common';

import {
    PrismaModule,
} from '@/infrastructure/database';

import {
    GetCurrentUserPreferencesQueryHandler,
    GetCurrentUserProfileQueryHandler,
    UpdateCurrentUserPreferencesCommandHandler,
    UpdateCurrentUserProfileCommandHandler,
} from './application';

import {
    USER_PROFILE_REPOSITORY,
} from './domain';

import {
    PrismaUserProfileRepository,
} from './infrastructure';

import {
    UsersController,
} from './presentation/http';

@Module({
    imports: [
        PrismaModule,
    ],

    controllers: [
        UsersController,
    ],

    providers: [
        GetCurrentUserProfileQueryHandler,

        GetCurrentUserPreferencesQueryHandler,

        UpdateCurrentUserProfileCommandHandler,

        UpdateCurrentUserPreferencesCommandHandler,

        PrismaUserProfileRepository,

        {
            provide:
                USER_PROFILE_REPOSITORY,

            useExisting:
                PrismaUserProfileRepository,
        },
    ],
})
export class UsersModule { }