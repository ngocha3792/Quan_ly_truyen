import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import { ClientIp, Public, UserAgent } from '@/common/decorators';

import { InvalidInputException } from '@/common/exceptions';

import { MfaService } from '../../../infrastructure';

import {
  ConfirmMfaPreAuthEnrollmentRequest,
  MfaTicketRequest,
  VerifyMfaPreAuthRequest,
} from '../requests';

import { AuthCookieService } from '../cookies';

@Controller('auth/mfa')
export class MfaController {
  constructor(
    private readonly mfa: MfaService,

    private readonly authCookies: AuthCookieService,
  ) {}

  @Post('enrollment')
  @Public()
  @HttpCode(HttpStatus.OK)
  async beginEnrollment(
    @Body()
    request: MfaTicketRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.mfa.beginPreAuthEnrollment(request.mfaTicket);

    return {
      secret: result.secret,

      otpAuthUri: result.otpAuthUri,

      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Post('enrollment/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  async confirmEnrollment(
    @Body()
    request: ConfirmMfaPreAuthEnrollmentRequest,

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

    const result = await this.mfa.confirmPreAuthEnrollment(
      request.mfaTicket,

      request.totpCode,

      {
        ipAddress,

        userAgent,

        deviceId: request.deviceId,

        deviceName: request.deviceName,
      },
    );

    this.authCookies.setAuthCookies(
      response,

      result.refreshToken,

      result.refreshTokenExpiresAt,
    );

    return loginResponse(
      result,

      result.recoveryCodes,
    );
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body()
    request: VerifyMfaPreAuthRequest,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    if (Boolean(request.totpCode) === Boolean(request.recoveryCode)) {
      throw new InvalidInputException({
        code: 'AUTH_MFA_EXACTLY_ONE_CODE_REQUIRED',

        message: 'Chỉ cung cấp một trong totpCode hoặc recoveryCode',
      });
    }

    this.authCookies.setNoStoreHeaders(response);

    const result = await this.mfa.verifyPreAuth(
      request.mfaTicket,

      {
        totpCode: request.totpCode,

        recoveryCode: request.recoveryCode,
      },

      {
        ipAddress,

        userAgent,

        deviceId: request.deviceId,

        deviceName: request.deviceName,
      },
    );

    this.authCookies.setAuthCookies(
      response,

      result.refreshToken,

      result.refreshTokenExpiresAt,
    );

    return loginResponse(result);
  }
}

function loginResponse(
  result: Awaited<ReturnType<MfaService['verifyPreAuth']>>,

  recoveryCodes?: readonly string[],
) {
  return {
    sessionId: result.sessionId,

    accessToken: result.accessToken,

    tokenType: result.tokenType,

    expiresIn: result.accessTokenExpiresInSeconds,

    expiresAt: result.accessTokenExpiresAt.toISOString(),

    user: result.user,

    ...(recoveryCodes
      ? {
          recoveryCodes,
        }
      : {}),
  };
}
