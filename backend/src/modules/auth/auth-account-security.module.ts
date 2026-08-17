import { Module } from '@nestjs/common';

import {
  ADMIN_USER_SECURITY_PERSISTENCE_PORT,
  ListAdminUserSessionsQueryHandler,
  ListAdminSecurityEventsQueryHandler,
  RevokeAdminUserSessionCommandHandler,
  RevokeAllAdminUserSessionsCommandHandler,
  UnlockAdminUserCommandHandler,
  DeleteAccountCommandHandler,
  GetCurrentUserQueryHandler,
  GetRecoveryEmailStatusQueryHandler,
  GetSecurityEventsQueryHandler,
  GetSecurityOverviewQueryHandler,
  GetSecurityQuestionCatalogQueryHandler,
  GetSecurityQuestionsQueryHandler,
  GetSessionsQueryHandler,
  RemoveRecoveryEmailCommandHandler,
  RemoveSecurityQuestionsCommandHandler,
  RequestRecoveryEmailCommandHandler,
  ResendRecoveryEmailCommandHandler,
  RevokeOtherSessionsCommandHandler,
  RevokeSessionCommandHandler,
  UpdateSecurityQuestionsCommandHandler,
  VerifyRecoveryEmailCommandHandler,
} from './application';
import {
  AdminUserSecurityController,
  AuthAccountController,
  MfaController,
  MfaSecurityController,
  RecoveryEmailSecurityController,
  SecurityQuestionsController,
} from './presentation/http';

import { AuthCoreModule } from './auth-core.module';
import { PrismaModule } from '@/infrastructure/database';
import { PrismaAdminUserSecurityPersistence } from './infrastructure';

@Module({
  imports: [AuthCoreModule, PrismaModule],
  controllers: [
    AdminUserSecurityController,
    AuthAccountController,
    RecoveryEmailSecurityController,
    SecurityQuestionsController,
    MfaController,
    MfaSecurityController,
  ],
  providers: [
    ListAdminUserSessionsQueryHandler,
    ListAdminSecurityEventsQueryHandler,
    RevokeAdminUserSessionCommandHandler,
    RevokeAllAdminUserSessionsCommandHandler,
    UnlockAdminUserCommandHandler,
    PrismaAdminUserSecurityPersistence,
    {
      provide: ADMIN_USER_SECURITY_PERSISTENCE_PORT,
      useExisting: PrismaAdminUserSecurityPersistence,
    },
    DeleteAccountCommandHandler,
    GetCurrentUserQueryHandler,
    GetSessionsQueryHandler,
    RevokeSessionCommandHandler,
    RevokeOtherSessionsCommandHandler,
    GetSecurityEventsQueryHandler,
    GetSecurityOverviewQueryHandler,
    GetSecurityQuestionCatalogQueryHandler,
    GetSecurityQuestionsQueryHandler,
    UpdateSecurityQuestionsCommandHandler,
    RemoveSecurityQuestionsCommandHandler,
    GetRecoveryEmailStatusQueryHandler,
    RequestRecoveryEmailCommandHandler,
    VerifyRecoveryEmailCommandHandler,
    ResendRecoveryEmailCommandHandler,
    RemoveRecoveryEmailCommandHandler,
  ],
})
export class AuthAccountSecurityModule {}
