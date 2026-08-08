import { Module } from '@nestjs/common';

import {
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
  AuthAccountController,
  MfaController,
  MfaSecurityController,
  RecoveryEmailSecurityController,
  SecurityQuestionsController,
} from './presentation/http';

import { AuthCoreModule } from './auth-core.module';

@Module({
  imports: [AuthCoreModule],
  controllers: [
    AuthAccountController,
    RecoveryEmailSecurityController,
    SecurityQuestionsController,
    MfaController,
    MfaSecurityController,
  ],
  providers: [
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
