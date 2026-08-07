import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type { Response } from 'express';

import { ClientIp, Public, UserAgent } from '@/common/decorators';

import { isAppException } from '@/common/exceptions';

import type { AuthConfig } from '@/config';

import {
  OAuthFlowService,
  OAuthHandoffStore,
  type OAuthHandoffResult,
} from '../../../infrastructure';

import { AuthCookieService } from '../cookies';

import { OAuthFinalizeRequest } from '../requests';

@Controller('auth/oauth')
export class OAuthController {
  private readonly authConfig: AuthConfig;

  constructor(
    configService: ConfigService,

    private readonly oauth: OAuthFlowService,

    private readonly handoffs: OAuthHandoffStore,

    private readonly authCookies: AuthCookieService,
  ) {
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');
  }

  /*
   * Browser đi trực tiếp vào endpoint này.
   *
   * Không gọi bằng HttpClient.
   */
  @Get(':provider')
  @Public()
  async start(
    @Param('provider')
    provider: string,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res()
    response: Response,
  ): Promise<void> {
    this.authCookies.setNoStoreHeaders(response);

    try {
      const authorization = await this.oauth.createAuthorizationUrl(
        provider,

        {
          ipAddress,

          userAgent,

          deviceName: 'TruyenHub Web',
        },
      );

      this.authCookies.setOAuthStateCookie(
        response,

        authorization.state,

        authorization.expiresAt,
      );

      response.redirect(
        HttpStatus.FOUND,

        authorization.url,
      );
    } catch (error: unknown) {
      await this.redirectError(
        response,

        error,
      );
    }
  }

  @Get(':provider/callback')
  @Public()
  async callback(
    @Param('provider')
    provider: string,

    @Query('code')
    code: string | undefined,

    @Query('state')
    state: string | string[] | undefined,

    @Query('error')
    providerError: string | undefined,

    @Headers('cookie')
    cookieHeader: string | undefined,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res()
    response: Response,
  ): Promise<void> {
    this.authCookies.setNoStoreHeaders(response);

    try {
      /*
       * Đọc trước rồi mới clear.
       */
      const browserState =
        this.authCookies.readRequiredOAuthState(cookieHeader);

      const normalizedState = typeof state === 'string' ? state : undefined;

      const result = await this.oauth.complete(
        provider,

        code,

        normalizedState,

        browserState,

        providerError,

        {
          ipAddress,

          userAgent,

          deviceName: 'TruyenHub Web',
        },
      );

      /*
       * Không trả accessToken ra HTML/URL.
       *
       * OAuthFlowService đã tạo session.
       * Browser chỉ nhận refresh cookie.
       */
      const handoff = await this.handoffs.issue({
        status: 'success',
      });

      this.authCookies.setAuthCookies(
        response,

        result.refreshToken,

        result.refreshTokenExpiresAt,
      );

      this.authCookies.clearOAuthStateCookie(response);

      this.redirectFrontend(
        response,

        handoff,
      );
    } catch (error: unknown) {
      this.authCookies.clearOAuthStateCookie(response);

      await this.redirectError(
        response,

        error,
      );
    }
  }

  /*
   * Frontend đổi handoff một lần để biết:
   *
   * - success
   * - cần MFA
   * - OAuth lỗi
   */
  @Post('finalize')
  @Public()
  @HttpCode(HttpStatus.OK)
  async finalize(
    @Body()
    request: OAuthFinalizeRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<OAuthHandoffResult> {
    this.authCookies.setNoStoreHeaders(response);

    return this.handoffs.consume(request.handoff);
  }

  private async redirectError(
    response: Response,

    error: unknown,
  ): Promise<void> {
    const result = toHandoffError(error);

    const handoff = await this.handoffs.issue(result);

    this.redirectFrontend(
      response,

      handoff,
    );
  }

  private redirectFrontend(
    response: Response,

    handoff: string,
  ): void {
    const url = new URL(this.authConfig.oauth.frontendCallbackUrl);

    url.searchParams.set(
      'handoff',

      handoff,
    );

    response.redirect(
      HttpStatus.FOUND,

      url.toString(),
    );
  }
}

function toHandoffError(error: unknown): OAuthHandoffResult {
  if (isAppException(error)) {
    const challenge = readMfaChallenge(
      error.code,

      error.details,
    );

    if (challenge) {
      return {
        status: 'mfa',

        challenge,
      };
    }

    return {
      status: 'error',

      code: error.code,

      /*
       * Không expose message nội bộ nếu
       * exception đánh dấu expose=false.
       */
      message: error.expose
        ? error.message
        : 'Không thể hoàn tất đăng nhập OAuth.',
    };
  }

  return {
    status: 'error',

    code: 'AUTH_OAUTH_UNEXPECTED_ERROR',

    message: 'Không thể hoàn tất đăng nhập OAuth.',
  };
}

function readMfaChallenge(
  code: string,

  details: Readonly<Record<string, unknown>> | undefined,
): {
  mfaTicket: string;

  mode: 'enroll' | 'verify';

  expiresAt: string;
} | null {
  /*
   * Generic MFA mới.
   *
   * Giữ 2 code legacy để rollout
   * backend không bị gãy nếu còn
   * Admin MFA cũ ở đâu đó.
   */
  if (
    code !== 'AUTH_MFA_REQUIRED' &&
    code !== 'AUTH_MFA_ENROLLMENT_REQUIRED' &&
    code !== 'AUTH_ADMIN_MFA_REQUIRED' &&
    code !== 'AUTH_ADMIN_MFA_ENROLLMENT_REQUIRED'
  ) {
    return null;
  }

  const mfaTicket = details?.['mfaTicket'];

  const mode = details?.['mode'];

  const expiresAt = details?.['expiresAt'];

  if (
    typeof mfaTicket !== 'string' ||
    (mode !== 'enroll' && mode !== 'verify') ||
    typeof expiresAt !== 'string'
  ) {
    return null;
  }

  return {
    mfaTicket,

    mode,

    expiresAt,
  };
}
