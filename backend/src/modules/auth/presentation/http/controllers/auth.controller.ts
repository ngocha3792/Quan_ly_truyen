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
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Query,
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
  GetSecurityEventsQuery,
  GetSecurityEventsQueryHandler,
  GetCurrentUserQuery,
  GetCurrentUserQueryHandler,
  GetSessionsQuery,
  GetSessionsQueryHandler,
  RequestEmailChangeCommand,
  RequestEmailChangeCommandHandler,
  ConfirmEmailChangeCommand,
  ConfirmEmailChangeCommandHandler,
  ChangePasswordCommand,
  ChangePasswordCommandHandler,
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
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  RequestEmailChangeRequest,
  ConfirmEmailChangeRequest,
  ResendEmailVerificationRequest,
} from '../requests';

import type {
  ChangePasswordResponse,
  CurrentUserResponse,
  SessionsResponse,
  LoginResponse,
  SecurityEventsResponse,
  RequestEmailChangeResponse,
  ConfirmEmailChangeResponse,
  ResendEmailVerificationResponse,
  RefreshTokenResponse,
  RegisterResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  VerifyEmailResponse,
} from '../responses';
import { CSRF_HEADER_NAME } from '@/common/constants';

import { CsrfTokenService } from '../../../infrastructure/security';

import { RefreshCookieCsrfGuard } from '../guards';

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

    private readonly csrfTokenService: CsrfTokenService,

    private readonly changePasswordCommandHandler: ChangePasswordCommandHandler,

    private readonly requestEmailChangeCommandHandler: RequestEmailChangeCommandHandler,

    private readonly confirmEmailChangeCommandHandler: ConfirmEmailChangeCommandHandler,
    private readonly getSecurityEventsQueryHandler: GetSecurityEventsQueryHandler,

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

    this.setAuthCookies(
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
      this.setAuthCookies(
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
      this.clearAuthCookies(response);
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

    this.clearAuthCookies(response);
  }
  @Post('logout-all')
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<void> {
    this.setNoStoreHeaders(response);

    /*
     * Endpoint này không có @Public().
     * Global JwtAuthGuard sẽ yêu cầu access token hợp lệ.
     */
    await this.logoutAllCommandHandler.execute(
      new LogoutAllCommand(
        userId,

        currentSessionId,
      ),
    );

    /*
     * Chỉ xóa cookie sau khi database revoke thành công.
     * Nếu database lỗi, cookie được giữ để client có thể retry.
     */
    this.clearAuthCookies(response);
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
    this.clearAuthCookies(response);
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
    this.setNoStoreHeaders(response);

    const result = await this.changePasswordCommandHandler.execute(
      new ChangePasswordCommand(
        userId,

        currentSessionId,

        request.currentPassword,

        request.newPassword,
      ),
    );

    /*
     * Không xóa refresh cookie.
     *
     * Current refresh token vẫn hợp lệ.
     * Chỉ access token hiện tại đã mất hiệu lực.
     *
     * Frontend phải gọi /auth/refresh ngay sau
     * response thành công.
     */
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
    this.setNoStoreHeaders(response);

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
    this.setNoStoreHeaders(response);

    const result = await this.confirmEmailChangeCommandHandler.execute(
      new ConfirmEmailChangeCommand(request.token),
    );

    /*
     * Confirmation đã revoke toàn bộ session.
     *
     * Xóa refresh + CSRF cookie của browser
     * hiện tại nếu chúng tồn tại.
     */
    this.clearAuthCookies(response);

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
  @Get('security-events')
  async getSecurityEvents(
    @CurrentUserId()
    userId: string | undefined,

    @Query(
      'limit',

      new DefaultValuePipe(20),

      new ParseIntPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    limit: number,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<SecurityEventsResponse> {
    this.setNoStoreHeaders(response);

    const result = await this.getSecurityEventsQueryHandler.execute(
      new GetSecurityEventsQuery(
        userId,

        limit,
      ),
    );

    return {
      total: result.total,

      events: result.events.map((event) => ({
        id: event.id,

        action: event.action,

        entityType: event.entityType,

        entityId: event.entityId,

        metadata: event.metadata,

        ipAddress: event.ipAddress,

        userAgent: event.userAgent,

        requestId: event.requestId,

        createdAt: event.createdAt.toISOString(),
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
      new RevokeSessionCommand(
        userId,

        currentSessionId,

        sessionId,
      ),
    );

    /*
     * Nếu user revoke chính session hiện tại,
     * refresh cookie của browser này cũng phải bị xóa.
     */
    if (sessionId === currentSessionId) {
      this.clearAuthCookies(response);
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

  private setAuthCookies(
    response: Response,

    refreshToken: string,

    expiresAt: Date,
  ): void {
    this.setRefreshTokenCookie(
      response,

      refreshToken,

      expiresAt,
    );

    const csrfToken = this.csrfTokenService.issue(
      refreshToken,

      expiresAt,
    );

    if (!csrfToken) {
      /*
       * Xóa cookie cũ nếu CSRF bị disable
       * ngoài production.
       */
      this.clearCsrfTokenCookie(response);

      return;
    }

    this.setCsrfTokenCookie(
      response,

      csrfToken,

      expiresAt,
    );
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

  private clearAuthCookies(response: Response): void {
    this.clearRefreshTokenCookie(response);

    this.clearCsrfTokenCookie(response);
  }

  private setCsrfTokenCookie(
    response: Response,

    csrfToken: string,

    expiresAt: Date,
  ): void {
    const csrf = this.authConfig.csrf;

    const refreshCookie = this.authConfig.refreshCookie;

    const options: CookieOptions = {
      /*
       * Double-submit cookie phải được
       * frontend đọc để gửi lại qua header.
       */
      httpOnly: false,

      secure: refreshCookie.secure,

      sameSite: refreshCookie.sameSite,

      path: csrf.cookiePath,

      expires: expiresAt,
    };

    if (csrf.cookieDomain) {
      options.domain = csrf.cookieDomain;
    }

    response.cookie(
      csrf.cookieName,

      csrfToken,

      options,
    );

    /*
     * Frontend cũng có thể lấy token từ
     * response header sau login/refresh.
     */
    response.setHeader(
      CSRF_HEADER_NAME,

      csrfToken,
    );
  }

  private clearCsrfTokenCookie(response: Response): void {
    const csrf = this.authConfig.csrf;

    const refreshCookie = this.authConfig.refreshCookie;

    const options: CookieOptions = {
      httpOnly: false,

      secure: refreshCookie.secure,

      sameSite: refreshCookie.sameSite,

      path: csrf.cookiePath,
    };

    if (csrf.cookieDomain) {
      options.domain = csrf.cookieDomain;
    }

    response.clearCookie(
      csrf.cookieName,

      options,
    );
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
