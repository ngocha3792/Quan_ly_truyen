import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import {
  ClientIp,
  CurrentSessionId,
  CurrentUserId,
  UserAgent,
} from '@/common/decorators';

import { Idempotent } from '@/common/decorators/interceptor';

import { MFA_PORT, type MfaPort } from '../../../application/ports';

import {
  BeginMfaSettingsEnrollmentRequest,
  ConfirmMfaSettingsEnrollmentRequest,
  VerifyMfaSensitiveActionRequest,
} from '../requests';

import { AuthCookieManager } from '../cookies';

@Controller('auth/security/mfa')
export class MfaSecurityController {
  constructor(
    @Inject(MFA_PORT)
    private readonly mfa: MfaPort,

    private readonly authCookies: AuthCookieManager,
  ) {}

  @Get()
  async status(
    @CurrentUserId()
    userId: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.mfa.getStatus(userId);

    return statusResponse(result);
  }

  @Post('enrollment')
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async beginEnrollment(
    @CurrentUserId()
    userId: string | undefined,

    @Body()
    request: BeginMfaSettingsEnrollmentRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.mfa.beginSettingsEnrollment(
      userId,

      request.currentPassword,
    );

    return {
      enrollmentId: result.enrollmentId,

      secret: result.secret,

      otpAuthUri: result.otpAuthUri,

      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Post('enrollment/confirm')
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async confirmEnrollment(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Body()
    request: ConfirmMfaSettingsEnrollmentRequest,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.mfa.confirmSettingsEnrollment(
      userId,

      sessionId,

      request.enrollmentId,

      request.totpCode,

      request.deviceName,

      {
        ipAddress,

        userAgent,

        deviceName: request.deviceName,
      },
    );

    return {
      status: statusResponse(result.status),

      recoveryCodes: result.recoveryCodes,
    };
  }

  @Delete()
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async disable(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Body()
    request: VerifyMfaSensitiveActionRequest,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.mfa.disable(
      userId,

      sessionId,

      request.currentPassword,

      request.totpCode,

      {
        ipAddress,

        userAgent,
      },
    );

    return statusResponse(result);
  }

  @Post('recovery-codes')
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async regenerateRecoveryCodes(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Body()
    request: VerifyMfaSensitiveActionRequest,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.mfa.regenerateRecoveryCodes(
      userId,

      sessionId,

      request.currentPassword,

      request.totpCode,

      {
        ipAddress,

        userAgent,
      },
    );

    return {
      recoveryCodes: result.recoveryCodes,

      generatedAt: result.generatedAt.toISOString(),
    };
  }
}

function statusResponse(result: {
  enabled: boolean;

  configuredAt: Date | null;

  recoveryCodesRemaining: number;
}) {
  return {
    enabled: result.enabled,

    configuredAt: result.configuredAt?.toISOString() ?? null,

    recoveryCodesRemaining: result.recoveryCodesRemaining,
  };
}
