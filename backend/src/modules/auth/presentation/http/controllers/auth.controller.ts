import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import {
  ClientIp,
  CurrentSessionId,
  CurrentUser,
  CurrentUserId,
  Public,
  SkipResponseEnvelope,
  UserAgent,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import type { AuthPrincipal } from '@/common/interfaces/auth';
import type { AuthConfig } from '@/config';
import {
  GetCurrentUserQuery,
  GetCurrentUserQueryHandler,
  GetSessionsQuery,
  GetSessionsQueryHandler,
  RevokeSessionCommand,
  RevokeSessionCommandHandler,
  ResendEmailVerificationCommand,
  ResendEmailVerificationCommandHandler,
  VerifyEmailCommand,
  VerifyEmailCommandHandler,
  RevokeAccessTokenCommand,
  RevokeAccessTokenCommandHandler,
  LoginCommand,
  LoginCommandHandler,
  LogoutAllCommand,
  LogoutAllCommandHandler,
  LogoutCommand,
  ForgotPasswordCommand,
  ForgotPasswordCommandHandler,
  ResetPasswordCommand,
  ResetPasswordCommandHandler,
  LogoutCommandHandler,
  RefreshTokenCommand,
  RefreshTokenCommandHandler,
  RegisterCommand,
  RegisterCommandHandler,
} from '../../../application';
import { InvalidRefreshTokenException } from '../../../domain/exceptions';
import {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  ResendEmailVerificationRequest,
} from '../requests';

import type {
  CurrentUserResponse,
  SessionsResponse,
  LoginResponse,
  ResendEmailVerificationResponse,
  RefreshTokenResponse,
  RegisterResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  VerifyEmailResponse,
} from '../responses';

@Controller('auth')
export class AuthController {
  private readonly authConfig: AuthConfig;

  constructor(
    private readonly registerCommandHandler: RegisterCommandHandler,

    private readonly loginCommandHandler: LoginCommandHandler,

    private readonly logoutCommandHandler: LogoutCommandHandler,
    private readonly resendEmailVerificationCommandHandler: ResendEmailVerificationCommandHandler,
    private readonly logoutAllCommandHandler: LogoutAllCommandHandler,

    private readonly refreshTokenCommandHandler: RefreshTokenCommandHandler,
    private readonly revokeAccessTokenCommandHandler: RevokeAccessTokenCommandHandler,

    private readonly verifyEmailCommandHandler: VerifyEmailCommandHandler,
    private readonly forgotPasswordCommandHandler: ForgotPasswordCommandHandler,

    private readonly resetPasswordCommandHandler: ResetPasswordCommandHandler,

    private readonly getCurrentUserQueryHandler: GetCurrentUserQueryHandler,

    private readonly getSessionsQueryHandler: GetSessionsQueryHandler,

    private readonly revokeSessionCommandHandler: RevokeSessionCommandHandler,

    configService: ConfigService,
  ) {
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');
  }

  @Post('register')
  @Public()
  @Idempotent({
    required: true,
    ttlSeconds: 86_400,
  })
  async register(@Body() request: RegisterRequest): Promise<RegisterResponse> {
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

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() request: LoginRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @Res({ passthrough: true })
    response: Response,
  ): Promise<LoginResponse> {
    this.setNoStoreHeaders(response);

    const result = await this.loginCommandHandler.execute(
      new LoginCommand(request.identifier, request.password, {
        ipAddress,
        userAgent,
        deviceId: request.deviceId,
        deviceName: request.deviceName,
      }),
    );

    this.setRefreshTokenCookie(
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
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Headers('cookie')
    cookieHeader: string | undefined,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<RefreshTokenResponse> {
    this.setNoStoreHeaders(response);

    try {
      const refreshToken = this.readRefreshTokenCookie(cookieHeader);

      const result = await this.refreshTokenCommandHandler.execute(
        new RefreshTokenCommand(refreshToken, {
          ipAddress,
          userAgent,
        }),
      );

      /*
       * Cookie cũ được ghi đè bằng refresh token mới.
       */
      this.setRefreshTokenCookie(
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
       * Xóa cookie cũ khi refresh thất bại,
       * tránh frontend tiếp tục gửi token không hợp lệ.
       */
      this.clearRefreshTokenCookie(response);

      throw error;
    }
  }

  @Post('logout')
  @Public()
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Headers('cookie')
    cookieHeader: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<void> {
    this.setNoStoreHeaders(response);

    const refreshToken = this.readOptionalRefreshTokenCookie(cookieHeader);

    /*
     * Chỉ xóa cookie sau khi thao tác revoke DB thành công.
     *
     * Nếu DB lỗi, exception được ném ra và cookie được giữ lại
     * để client có thể retry logout.
     */
    await this.logoutCommandHandler.execute(new LogoutCommand(refreshToken));

    this.clearRefreshTokenCookie(response);
  }
  @Post('logout-all')
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUserId()
    userId: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<void> {
    this.setNoStoreHeaders(response);

    /*
     * Endpoint này không có @Public().
     * Global JwtAuthGuard sẽ yêu cầu access token hợp lệ.
     */
    await this.logoutAllCommandHandler.execute(new LogoutAllCommand(userId));

    /*
     * Chỉ xóa cookie sau khi database revoke thành công.
     * Nếu database lỗi, cookie được giữ để client có thể retry.
     */
    this.clearRefreshTokenCookie(response);
  }

  @Post('revoke-access-token')
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAccessToken(
    @CurrentUser()
    principal: AuthPrincipal,
  ): Promise<void> {
    await this.revokeAccessTokenCommandHandler.execute(
      new RevokeAccessTokenCommand(principal.tokenId, principal.tokenExpiresAt),
    );
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() request: VerifyEmailRequest,
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

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body()
    request: ResetPasswordRequest,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<ResetPasswordResponse> {
    this.setNoStoreHeaders(response);

    const result = await this.resetPasswordCommandHandler.execute(
      new ResetPasswordCommand(request.token, request.newPassword),
    );

    /*
     * Password reset đã revoke toàn bộ session,
     * cookie hiện tại không còn giá trị.
     */
    this.clearRefreshTokenCookie(response);

    return {
      passwordReset: result.passwordReset,

      sessionsRevoked: result.sessionsRevoked,

      resetAt: result.resetAt.toISOString(),
    };
  }

  @Get('me')
  async getCurrentUser(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<CurrentUserResponse> {
    this.setNoStoreHeaders(response);

    const result = await this.getCurrentUserQueryHandler.execute(
      new GetCurrentUserQuery(userId, sessionId),
    );

    return {
      id: result.id,
      sessionId: result.sessionId,

      email: result.email,
      username: result.username,
      displayName: result.displayName,
      bio: result.bio,

      status: result.status,

      emailVerified: result.emailVerified,

      emailVerifiedAt: result.emailVerifiedAt?.toISOString() ?? null,

      lastLoginAt: result.lastLoginAt?.toISOString() ?? null,

      avatar: result.avatar,

      authorProfile: result.authorProfile,

      roles: result.roles,

      permissions: result.permissions,

      createdAt: result.createdAt.toISOString(),

      updatedAt: result.updatedAt.toISOString(),
    };
  }

  @Get('sessions')
  async getSessions(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<SessionsResponse> {
    this.setNoStoreHeaders(response);

    const result = await this.getSessionsQueryHandler.execute(
      new GetSessionsQuery(userId, currentSessionId),
    );

    return {
      total: result.total,

      sessions: result.sessions.map((session) => ({
        id: session.id,

        isCurrent: session.isCurrent,

        deviceId: session.deviceId,

        deviceName: session.deviceName,

        ipAddress: session.ipAddress,

        userAgent: session.userAgent,

        lastUsedAt: session.lastUsedAt?.toISOString() ?? null,

        createdAt: session.createdAt.toISOString(),

        expiresAt: session.expiresAt.toISOString(),
      })),
    };
  }

  @Delete('sessions/:sessionId')
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Param(
      'sessionId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sessionId: string,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<void> {
    this.setNoStoreHeaders(response);

    await this.revokeSessionCommandHandler.execute(
      new RevokeSessionCommand(userId, sessionId),
    );

    /*
     * Nếu user revoke chính session hiện tại,
     * refresh cookie của browser này cũng phải bị xóa.
     */
    if (sessionId === currentSessionId) {
      this.clearRefreshTokenCookie(response);
    }
  }

  private readOptionalRefreshTokenCookie(
    cookieHeader: string | undefined,
  ): string | undefined {
    if (!cookieHeader) {
      return undefined;
    }

    const cookieName = this.authConfig.refreshCookie.name;

    for (const part of cookieHeader.split(';')) {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex < 0) {
        continue;
      }

      const name = part.slice(0, separatorIndex).trim();

      if (name !== cookieName) {
        continue;
      }

      const encodedValue = part.slice(separatorIndex + 1).trim();

      if (!encodedValue) {
        return undefined;
      }

      try {
        const value = decodeURIComponent(encodedValue);

        return value || undefined;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private readRefreshTokenCookie(cookieHeader: string | undefined): string {
    if (!cookieHeader) {
      throw new InvalidRefreshTokenException();
    }

    const cookieName = this.authConfig.refreshCookie.name;

    for (const part of cookieHeader.split(';')) {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex < 0) {
        continue;
      }

      const name = part.slice(0, separatorIndex).trim();

      if (name !== cookieName) {
        continue;
      }

      const encodedValue = part.slice(separatorIndex + 1).trim();

      if (!encodedValue) {
        throw new InvalidRefreshTokenException();
      }

      try {
        const value = decodeURIComponent(encodedValue);

        if (!value) {
          throw new InvalidRefreshTokenException();
        }

        return value;
      } catch (error: unknown) {
        if (error instanceof InvalidRefreshTokenException) {
          throw error;
        }

        throw new InvalidRefreshTokenException(error);
      }
    }

    throw new InvalidRefreshTokenException();
  }

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(
      this.authConfig.refreshCookie.name,
      refreshToken,
      this.createRefreshCookieOptions(expiresAt),
    );
  }

  private clearRefreshTokenCookie(response: Response): void {
    const cookie = this.authConfig.refreshCookie;

    const options: CookieOptions = {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
    };

    if (cookie.domain) {
      options.domain = cookie.domain;
    }

    response.clearCookie(cookie.name, options);
  }

  private createRefreshCookieOptions(expiresAt: Date): CookieOptions {
    const cookie = this.authConfig.refreshCookie;

    const options: CookieOptions = {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      expires: expiresAt,
    };

    if (cookie.domain) {
      options.domain = cookie.domain;
    }

    return options;
  }

  private setNoStoreHeaders(response: Response): void {
    response.setHeader('Cache-Control', 'no-store, private');

    response.setHeader('Pragma', 'no-cache');
  }
}
