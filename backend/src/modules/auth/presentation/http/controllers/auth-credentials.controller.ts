import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import { CurrentSessionId, CurrentUserId, Public } from '@/common/decorators';

import { Idempotent } from '@/common/decorators/interceptor';

import {
  ChangePasswordCommand,
  ChangePasswordCommandHandler,
  ConfirmEmailChangeCommand,
  ConfirmEmailChangeCommandHandler,
  ForgotPasswordCommand,
  ForgotPasswordCommandHandler,
  RegisterCommand,
  RegisterCommandHandler,
  RequestEmailChangeCommand,
  RequestEmailChangeCommandHandler,
  ResendEmailVerificationCommand,
  ResendEmailVerificationCommandHandler,
  ResetPasswordCommand,
  ResetPasswordCommandHandler,
  ValidatePasswordResetTokenQuery,
  ValidatePasswordResetTokenQueryHandler,
  VerifyEmailCommand,
  VerifyEmailCommandHandler,
} from '../../../application';

import {
  ChangePasswordRequest,
  ConfirmEmailChangeRequest,
  ForgotPasswordRequest,
  RegisterRequest,
  RequestEmailChangeRequest,
  ResendEmailVerificationRequest,
  ResetPasswordRequest,
  ValidatePasswordResetTokenRequest,
  VerifyEmailRequest,
} from '../requests';

import type {
  ChangePasswordResponse,
  ConfirmEmailChangeResponse,
  ForgotPasswordResponse,
  RegisterResponse,
  RequestEmailChangeResponse,
  ResendEmailVerificationResponse,
  ResetPasswordResponse,
  ValidatePasswordResetTokenResponse,
  VerifyEmailResponse,
} from '../responses';

import { AuthCookieService } from '../cookies';

@Controller('auth')
export class AuthCredentialsController {
  constructor(
    private readonly registerCommandHandler: RegisterCommandHandler,

    private readonly verifyEmailCommandHandler: VerifyEmailCommandHandler,

    private readonly resendEmailVerificationCommandHandler: ResendEmailVerificationCommandHandler,

    private readonly forgotPasswordCommandHandler: ForgotPasswordCommandHandler,

    private readonly resetPasswordCommandHandler: ResetPasswordCommandHandler,

    private readonly validatePasswordResetTokenQueryHandler: ValidatePasswordResetTokenQueryHandler,
    private readonly changePasswordCommandHandler: ChangePasswordCommandHandler,

    private readonly requestEmailChangeCommandHandler: RequestEmailChangeCommandHandler,

    private readonly confirmEmailChangeCommandHandler: ConfirmEmailChangeCommandHandler,

    private readonly authCookies: AuthCookieService,
  ) {}

  @Post('register')
  @Public()
  @Idempotent({
    required: true,

    ttlSeconds: 86_400,
  })
  async register(
    @Body()
    request: RegisterRequest,
  ): Promise<RegisterResponse> {
    const result = await this.registerCommandHandler.execute(
      new RegisterCommand(
        request.email,

        request.username,

        request.password,

        request.displayName,
      ),
    );

    return {
      id: result.id,

      email: result.email,

      username: result.username,

      displayName: result.displayName,

      verificationRequired: result.verificationRequired,
    };
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body()
    request: VerifyEmailRequest,
  ): Promise<VerifyEmailResponse> {
    const result = await this.verifyEmailCommandHandler.execute(
      new VerifyEmailCommand(request.token),
    );

    return {
      emailVerified: result.emailVerified,

      alreadyVerified: result.alreadyVerified,

      verifiedAt: result.verifiedAt.toISOString(),
    };
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async resendEmailVerification(
    @Body()
    request: ResendEmailVerificationRequest,
  ): Promise<ResendEmailVerificationResponse> {
    return this.resendEmailVerificationCommandHandler.execute(
      new ResendEmailVerificationCommand(request.email),
    );
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body()
    request: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    return this.forgotPasswordCommandHandler.execute(
      new ForgotPasswordCommand(request.email),
    );
  }

  @Post('reset-password/validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  async validatePasswordResetToken(
    @Body()
    request: ValidatePasswordResetTokenRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<ValidatePasswordResetTokenResponse> {
    /*
     * Response chứa thông tin về reset token,
     * không cho browser/proxy cache.
     */
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.validatePasswordResetTokenQueryHandler.execute(
      new ValidatePasswordResetTokenQuery(request.token),
    );

    return {
      valid: result.valid,

      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body()
    request: ResetPasswordRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<ResetPasswordResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.resetPasswordCommandHandler.execute(
      new ResetPasswordCommand(
        request.token,

        request.newPassword,
      ),
    );

    /*
     * Password reset đã revoke toàn bộ session.
     */
    this.authCookies.clearAuthCookies(response);

    return {
      passwordReset: result.passwordReset,

      sessionsRevoked: result.sessionsRevoked,

      resetAt: result.resetAt.toISOString(),
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Body()
    request: ChangePasswordRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<ChangePasswordResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.changePasswordCommandHandler.execute(
      new ChangePasswordCommand(
        userId,

        currentSessionId,

        request.currentPassword,

        request.newPassword,
      ),
    );

    return {
      passwordChanged: result.passwordChanged,

      otherSessionsRevoked: result.otherSessionsRevoked,

      currentSessionKept: result.currentSessionKept,

      accessTokenInvalidated: result.accessTokenInvalidated,

      refreshRequired: result.refreshRequired,

      changedAt: result.changedAt.toISOString(),
    };
  }

  @Post('change-email')
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async requestEmailChange(
    @CurrentUserId()
    userId: string | undefined,

    @Body()
    request: RequestEmailChangeRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<RequestEmailChangeResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.requestEmailChangeCommandHandler.execute(
      new RequestEmailChangeCommand(
        userId,

        request.currentPassword,

        request.newEmail,
      ),
    );

    return {
      emailChangeRequested: result.emailChangeRequested,

      pendingEmail: result.pendingEmail,

      verificationRequired: result.verificationRequired,

      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Post('change-email/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(
    @Body()
    request: ConfirmEmailChangeRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<ConfirmEmailChangeResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.confirmEmailChangeCommandHandler.execute(
      new ConfirmEmailChangeCommand(request.token),
    );

    /*
     * Email change đã revoke toàn bộ session.
     */
    this.authCookies.clearAuthCookies(response);

    return {
      emailChanged: result.emailChanged,

      alreadyChanged: result.alreadyChanged,

      previousEmail: result.previousEmail,

      email: result.email,

      sessionsRevoked: result.sessionsRevoked,

      reauthenticationRequired: result.reauthenticationRequired,

      changedAt: result.changedAt.toISOString(),
    };
  }
}
