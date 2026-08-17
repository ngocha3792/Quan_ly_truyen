import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';

import {
  ClientIp,
  CurrentSessionId,
  CurrentUser,
  CurrentUserId,
  Public,
  SkipResponseEnvelope,
  UserAgent,
} from '@/common/decorators';

import type { AuthPrincipal } from '@/common/interfaces/auth';

import {
  LoginCommand,
  LoginCommandHandler,
  LogoutAllCommand,
  LogoutAllCommandHandler,
  LogoutCommand,
  LogoutCommandHandler,
  RefreshTokenCommand,
  RefreshTokenCommandHandler,
  RevokeAccessTokenCommand,
  RevokeAccessTokenCommandHandler,
} from '../../../application';

import {
  InvalidRefreshTokenException,
  RefreshTokenReuseDetectedException,
} from '../../../domain/exceptions';

import { LoginRequest } from '../requests';

import type { LoginResponse, RefreshTokenResponse } from '../responses';

import { AuthCookieManager } from '../cookies';

import { RefreshCookieCsrfGuard } from '../guards';

@Controller('auth')
export class AuthTokenController {
  constructor(
    private readonly loginCommandHandler: LoginCommandHandler,

    private readonly logoutCommandHandler: LogoutCommandHandler,

    private readonly logoutAllCommandHandler: LogoutAllCommandHandler,

    private readonly refreshTokenCommandHandler: RefreshTokenCommandHandler,

    private readonly revokeAccessTokenCommandHandler: RevokeAccessTokenCommandHandler,

    private readonly authCookies: AuthCookieManager,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body()
    request: LoginRequest,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<LoginResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.loginCommandHandler.execute(
      new LoginCommand(
        request.identifier,

        request.password,

        {
          ipAddress,

          userAgent,

          deviceId: request.deviceId,

          deviceName: request.deviceName,
        },
      ),
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

  @Post('refresh')
  @Public()
  @UseGuards(RefreshCookieCsrfGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Headers('cookie')
    cookieHeader: string | undefined,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<RefreshTokenResponse> {
    this.authCookies.setNoStoreHeaders(response);

    try {
      const refreshToken =
        this.authCookies.readRequiredRefreshToken(cookieHeader);

      const result = await this.refreshTokenCommandHandler.execute(
        new RefreshTokenCommand(
          refreshToken,

          {
            ipAddress,

            userAgent,
          },
        ),
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
      };
    } catch (error: unknown) {
      /*
       * Chỉ clear browser credential khi backend
       * đã xác định refresh credential/session
       * thật sự không còn hợp lệ.
       *
       * Không clear cookie với DB/network/internal 5xx,
       * vì những lỗi đó có thể retry.
       */
      if (isTerminalRefreshSessionError(error)) {
        this.authCookies.clearAuthCookies(response);
      }

      throw error;
    }
  }

  @Post('logout')
  @Public()
  @UseGuards(RefreshCookieCsrfGuard)
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Headers('cookie')
    cookieHeader: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<void> {
    this.authCookies.setNoStoreHeaders(response);

    const refreshToken =
      this.authCookies.readOptionalRefreshToken(cookieHeader);

    await this.logoutCommandHandler.execute(new LogoutCommand(refreshToken));

    this.authCookies.clearAuthCookies(response);
  }

  @Post('logout-all')
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<void> {
    this.authCookies.setNoStoreHeaders(response);

    await this.logoutAllCommandHandler.execute(
      new LogoutAllCommand(
        userId,

        currentSessionId,
      ),
    );

    this.authCookies.clearAuthCookies(response);
  }

  @Post('revoke-access-token')
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAccessToken(
    @CurrentUser()
    principal: AuthPrincipal,
  ): Promise<void> {
    await this.revokeAccessTokenCommandHandler.execute(
      new RevokeAccessTokenCommand(
        principal.tokenId,

        principal.tokenExpiresAt,
      ),
    );
  }
}

function isTerminalRefreshSessionError(error: unknown): boolean {
  return (
    error instanceof InvalidRefreshTokenException ||
    error instanceof RefreshTokenReuseDetectedException
  );
}
