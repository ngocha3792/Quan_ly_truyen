import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { AuthenticationRequiredException } from '@/common/exceptions';
import {
  ListAdminSecurityEventsQuery,
  ListAdminSecurityEventsQueryHandler,
  ListAdminUserSessionsQuery,
  ListAdminUserSessionsQueryHandler,
  RevokeAdminUserSessionCommand,
  RevokeAdminUserSessionCommandHandler,
  RevokeAllAdminUserSessionsCommand,
  RevokeAllAdminUserSessionsCommandHandler,
  UnlockAdminUserCommand,
  UnlockAdminUserCommandHandler,
} from '../../../application';
import {
  toAdminSecurityEventResponse,
  toAdminSessionResponse,
  type AdminSecurityEventResponse,
  type AdminSessionResponse,
} from '../responses';
@Controller('admin/users/:userId')
export class AdminUserSecurityController {
  constructor(
    private readonly listSessions: ListAdminUserSessionsQueryHandler,
    private readonly listSecurityEvents: ListAdminSecurityEventsQueryHandler,
    private readonly revokeSession: RevokeAdminUserSessionCommandHandler,
    private readonly revokeAllSessions: RevokeAllAdminUserSessionsCommandHandler,
    private readonly unlockUser: UnlockAdminUserCommandHandler,
  ) {}
  @Get('sessions')
  @RequirePermissions(
    PermissionCode.USER_MANAGE,
    PermissionCode.USER_SECURITY_READ,
  )
  async sessions(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<readonly AdminSessionResponse[]> {
    return (
      await this.listSessions.execute(new ListAdminUserSessionsQuery(userId))
    ).map(toAdminSessionResponse);
  }
  @Post('sessions/:sessionId/revoke')
  @RequirePermissions(
    PermissionCode.USER_MANAGE,
    PermissionCode.USER_SECURITY_MANAGE,
  )
  async revoke(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @CurrentUserId() actor: string | undefined,
  ) {
    await this.revokeSession.execute(
      new RevokeAdminUserSessionCommand(this.actor(actor), userId, sessionId),
    );
    return { success: true as const };
  }
  @Post('sessions/revoke-all')
  @RequirePermissions(
    PermissionCode.USER_MANAGE,
    PermissionCode.USER_SECURITY_MANAGE,
  )
  async revokeAll(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUserId() actor: string | undefined,
  ) {
    const revokedCount = await this.revokeAllSessions.execute(
      new RevokeAllAdminUserSessionsCommand(this.actor(actor), userId),
    );
    return { success: true as const, revokedCount };
  }
  @Post('unlock')
  @RequirePermissions(
    PermissionCode.USER_MANAGE,
    PermissionCode.USER_SECURITY_MANAGE,
  )
  async unlock(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUserId() actor: string | undefined,
  ) {
    await this.unlockUser.execute(
      new UnlockAdminUserCommand(this.actor(actor), userId),
    );
    return { success: true as const };
  }
  @Get('security-events')
  @RequirePermissions(
    PermissionCode.USER_MANAGE,
    PermissionCode.USER_SECURITY_READ,
  )
  async events(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<readonly AdminSecurityEventResponse[]> {
    return (
      await this.listSecurityEvents.execute(
        new ListAdminSecurityEventsQuery(userId),
      )
    ).map(toAdminSecurityEventResponse);
  }
  private actor(actor: string | undefined): string {
    if (!actor)
      throw new AuthenticationRequiredException({
        code: 'ADMIN_USER_SECURITY_ACTOR_REQUIRED',
        message: 'Không xác định được quản trị viên hiện tại',
      });
    return actor;
  }
}
