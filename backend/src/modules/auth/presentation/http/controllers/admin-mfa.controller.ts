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

import { AdminMfaService } from '../../../infrastructure';
import {
  AdminMfaTicketRequest,
  ConfirmAdminMfaEnrollmentRequest,
  VerifyAdminMfaRequest,
} from '../requests';
import { AuthCookieService } from '../cookies';

@Controller('auth/mfa/admin')
export class AdminMfaController {
  constructor(
    private readonly mfa: AdminMfaService,
    private readonly authCookies: AuthCookieService,
  ) {}

  @Post('enrollment')
  @Public()
  @HttpCode(HttpStatus.OK)
  async beginEnrollment(
    @Body() request: AdminMfaTicketRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);
    const result = await this.mfa.beginEnrollment(request.mfaTicket);
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
    @Body() request: ConfirmAdminMfaEnrollmentRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);
    const result = await this.mfa.confirmEnrollment(
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
    return loginResponse(result, result.recoveryCodes);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() request: VerifyAdminMfaRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (Boolean(request.totpCode) === Boolean(request.recoveryCode)) {
      throw new InvalidInputException({
        code: 'AUTH_MFA_EXACTLY_ONE_CODE_REQUIRED',
        message: 'Chỉ cung cấp một trong totpCode hoặc recoveryCode',
      });
    }
    this.authCookies.setNoStoreHeaders(response);
    const result = await this.mfa.verify(
      request.mfaTicket,
      { totpCode: request.totpCode, recoveryCode: request.recoveryCode },
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
  result: Awaited<ReturnType<AdminMfaService['verify']>>,
  recoveryCodes?: readonly string[],
) {
  return {
    sessionId: result.sessionId,
    accessToken: result.accessToken,
    tokenType: result.tokenType,
    expiresIn: result.accessTokenExpiresInSeconds,
    expiresAt: result.accessTokenExpiresAt.toISOString(),
    user: result.user,
    ...(recoveryCodes ? { recoveryCodes } : {}),
  };
}
