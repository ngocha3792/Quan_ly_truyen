import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';

import { AuthModule } from '@/modules/auth';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  ApproveAuthorApplicationCommandHandler,
  GetAuthorApplicationConfigQueryHandler,
  GetAuthorApplicationQueryHandler,
  GetMyAuthorApplicationQueryHandler,
  ListAuthorApplicationsQueryHandler,
  RejectAuthorApplicationCommandHandler,
  SaveAuthorApplicationDraftCommandHandler,
  SubmitAuthorApplicationCommandHandler,
} from './application';

import { PrismaAuthorApplicationPersistence } from './infrastructure';

import {
  AdminAuthorApplicationsController,
  AuthorApplicationsController,
} from './presentation/http';

@Module({
  imports: [
    PrismaModule,

    /*
     * Import AuthModule duy nhất để dùng
     * AccessAuthorizationCacheService.
     *
     * AuthModule đã chủ động export service này
     * cho module role/author.
     */
    AuthModule,
  ],

  controllers: [
    AuthorApplicationsController,

    AdminAuthorApplicationsController,
  ],

  providers: [
    GetAuthorApplicationConfigQueryHandler,

    GetMyAuthorApplicationQueryHandler,

    GetAuthorApplicationQueryHandler,

    ListAuthorApplicationsQueryHandler,

    SaveAuthorApplicationDraftCommandHandler,

    SubmitAuthorApplicationCommandHandler,

    ApproveAuthorApplicationCommandHandler,

    RejectAuthorApplicationCommandHandler,

    PrismaAuthorApplicationPersistence,

    {
      provide: AUTHOR_APPLICATION_PERSISTENCE_PORT,

      useExisting: PrismaAuthorApplicationPersistence,
    },
  ],
})
export class AuthorApplicationsModule {}
