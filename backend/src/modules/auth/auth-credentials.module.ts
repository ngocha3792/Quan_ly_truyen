import { Module } from '@nestjs/common';

import {
  ChangePasswordCommandHandler,
  ConfirmEmailChangeCommandHandler,
  ForgotPasswordCommandHandler,
  RegisterCommandHandler,
  RequestEmailChangeCommandHandler,
  ResendEmailVerificationCommandHandler,
  ResetPasswordCommandHandler,
  ValidatePasswordResetTokenQueryHandler,
  VerifyEmailCommandHandler,
} from './application';
import { AuthCredentialsController } from './presentation/http';

import { AuthCoreModule } from './auth-core.module';

@Module({
  imports: [AuthCoreModule],
  controllers: [AuthCredentialsController],
  providers: [
    RegisterCommandHandler,
    VerifyEmailCommandHandler,
    ResendEmailVerificationCommandHandler,
    ForgotPasswordCommandHandler,
    ValidatePasswordResetTokenQueryHandler,
    ResetPasswordCommandHandler,
    RequestEmailChangeCommandHandler,
    ConfirmEmailChangeCommandHandler,
    ChangePasswordCommandHandler,
  ],
})
export class AuthCredentialsModule {}
