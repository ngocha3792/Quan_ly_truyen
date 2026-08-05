import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Redirect,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { ClientIp, Public, UserAgent } from '@/common/decorators';

import { OAuthFlowService } from '../../../infrastructure';
import { AuthCookieService } from '../cookies';

@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthFlowService,
    private readonly authCookies: AuthCookieService,
  ) {}

  @Get(':provider')
  @Public()
  @Redirect('', HttpStatus.FOUND)
  async start(
    @Param('provider') provider: string,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);
    const authorization = await this.oauth.createAuthorizationUrl(provider, {
      ipAddress,
      userAgent,
    });
    this.authCookies.setOAuthStateCookie(
      response,
      authorization.state,
      authorization.expiresAt,
    );

    return { url: authorization.url };
  }

  @Get(':provider/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | string[] | undefined,
    @Query('error') providerError: string | undefined,
    @Headers('cookie') cookieHeader: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authCookies.setNoStoreHeaders(response);
    this.authCookies.clearOAuthStateCookie(response);
    const browserState = this.authCookies.readRequiredOAuthState(cookieHeader);
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
      },
    );
    this.authCookies.setAuthCookies(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return {
      sessionId: result.sessionId,
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.accessTokenExpiresInSeconds,
      expiresAt: result.accessTokenExpiresAt.toISOString(),
      user: result.user,
    };
  }
}
