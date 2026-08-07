import {
    Module,
} from '@nestjs/common';

import {
    PrismaModule,
} from '@/infrastructure/database';

import {
    GetCurrentUserPreferencesQueryHandler,
    GetCurrentUserProfileQueryHandler,
    USER_PROFILE_PERSISTENCE_PORT,
    USER_PROFILE_READER_PORT,
    UpdateCurrentUserPreferencesCommandHandler,
    UpdateCurrentUserProfileCommandHandler,
} from './application';

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
                USER_PROFILE_READER_PORT,

            useExisting:
                PrismaUserProfileRepository,
        },

        {
            provide:
                USER_PROFILE_PERSISTENCE_PORT,

            useExisting:
                PrismaUserProfileRepository,
        },
    ],
})
export class UsersModule { }
