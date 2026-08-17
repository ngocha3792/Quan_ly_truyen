import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import {
  ClientIp,
  CurrentSessionId,
  CurrentUserId,
  SkipResponseEnvelope,
  UserAgent,
} from '@/common/decorators';

import { Idempotent } from '@/common/decorators/interceptor';

import {
  DeleteAccountCommand,
  DeleteAccountCommandHandler,
  GetCurrentUserQuery,
  GetCurrentUserQueryHandler,
  GetSecurityEventsQuery,
  GetSecurityEventsQueryHandler,
  GetSessionsQuery,
  GetSecurityOverviewQuery,
  GetSecurityOverviewQueryHandler,
  GetSessionsQueryHandler,
  RevokeOtherSessionsCommand,
  RevokeOtherSessionsCommandHandler,
  RevokeSessionCommand,
  RevokeSessionCommandHandler,
} from '../../../application';
import type { CurrentUserResultDto } from '../../../application';

import { AuthCookieManager } from '../cookies';

import type {
  SecurityOverviewResponse,
  CurrentUserResponse,
  SecurityEventsResponse,
  RevokeOtherSessionsResponse,
  SessionsResponse,
} from '../responses';

import { DeleteAccountRequest } from '../requests';

@Controller('auth')
export class AuthAccountController {
  constructor(
    private readonly getCurrentUserQueryHandler: GetCurrentUserQueryHandler,

    private readonly getSessionsQueryHandler: GetSessionsQueryHandler,

    private readonly getSecurityEventsQueryHandler: GetSecurityEventsQueryHandler,

    private readonly revokeSessionCommandHandler: RevokeSessionCommandHandler,

    private readonly revokeOtherSessionsCommandHandler: RevokeOtherSessionsCommandHandler,

    private readonly authCookies: AuthCookieManager,

    private readonly deleteAccountCommandHandler: DeleteAccountCommandHandler,
    private readonly getSecurityOverviewQueryHandler: GetSecurityOverviewQueryHandler,
  ) {}

  @Get('me')
  async getCurrentUser(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<CurrentUserResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.getCurrentUserQueryHandler.execute(
      new GetCurrentUserQuery(userId, sessionId),
    );

    return toCurrentUserResponse(result);
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
    this.authCookies.setNoStoreHeaders(response);

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
  @Delete('account')
  @Idempotent({
    required: true,

    ttlSeconds: 86_400,
  })
  @SkipResponseEnvelope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Body()
    request: DeleteAccountRequest,

    @ClientIp()
    clientIp: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<void> {
    this.authCookies.setNoStoreHeaders(response);

    await this.deleteAccountCommandHandler.execute(
      new DeleteAccountCommand(
        userId,

        currentSessionId,

        request.password,

        request.confirmation,

        clientIp,

        userAgent,
      ),
    );

    /*
     * Persistence đã revoke session.
     *
     * Browser vẫn có refresh/CSRF cookies,
     * nên clear chúng ở response.
     */
    this.authCookies.clearAuthCookies(response);
  }

  @Get('security-overview')
  async getSecurityOverview(
    @CurrentUserId()
    userId: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<SecurityOverviewResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.getSecurityOverviewQueryHandler.execute(
      new GetSecurityOverviewQuery(userId),
    );

    return {
      passwordConfigured: result.passwordConfigured,

      passwordUpdatedAt: result.passwordUpdatedAt?.toISOString() ?? null,

      mfaEnabled: result.mfaEnabled,

      mfaConfiguredAt: result.mfaConfiguredAt?.toISOString() ?? null,

      recoveryEmail: result.recoveryEmail,

      recoveryEmailVerified: result.recoveryEmailVerified,

      securityQuestionsConfigured: result.securityQuestionsConfigured,

      trustedDeviceCount: result.trustedDeviceCount,
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

    @Res({ passthrough: true })
    response: Response,
  ): Promise<SecurityEventsResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.getSecurityEventsQueryHandler.execute(
      new GetSecurityEventsQuery(userId, limit),
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

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<RevokeOtherSessionsResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const revokedCount = await this.revokeOtherSessionsCommandHandler.execute(
      new RevokeOtherSessionsCommand(
        userId,

        currentSessionId,
      ),
    );

    return {
      revokedCount,
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
    this.authCookies.setNoStoreHeaders(response);

    await this.revokeSessionCommandHandler.execute(
      new RevokeSessionCommand(userId, currentSessionId, sessionId),
    );

    if (sessionId === currentSessionId) {
      this.authCookies.clearAuthCookies(response);
    }
  }
}

function toCurrentUserResponse(
  result: CurrentUserResultDto,
): CurrentUserResponse {
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
