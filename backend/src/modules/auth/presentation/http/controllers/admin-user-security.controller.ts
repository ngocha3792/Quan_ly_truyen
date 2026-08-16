import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { AuthenticationRequiredException } from '@/common/exceptions';
import { AdminUserSecurityService } from '../../../application/services';
import { toAdminSecurityEventResponse, toAdminSessionResponse, type AdminSecurityEventResponse, type AdminSessionResponse } from '../responses';
@Controller('admin/users/:userId')
export class AdminUserSecurityController {
  constructor(private readonly security:AdminUserSecurityService){}
  @Get('sessions') @RequirePermissions(PermissionCode.USER_MANAGE,PermissionCode.USER_SECURITY_READ)
  async sessions(@Param('userId',new ParseUUIDPipe({version:'4'})) userId:string):Promise<readonly AdminSessionResponse[]>{ return (await this.security.listSessions(userId)).map(toAdminSessionResponse); }
  @Post('sessions/:sessionId/revoke') @RequirePermissions(PermissionCode.USER_MANAGE,PermissionCode.USER_SECURITY_MANAGE)
  async revoke(@Param('userId',new ParseUUIDPipe({version:'4'})) userId:string,@Param('sessionId',new ParseUUIDPipe({version:'4'})) sessionId:string,@CurrentUserId() actor:string|undefined){ await this.security.revokeSession({actorUserId:this.actor(actor),userId,sessionId}); return {success:true as const}; }
  @Post('sessions/revoke-all') @RequirePermissions(PermissionCode.USER_MANAGE,PermissionCode.USER_SECURITY_MANAGE)
  async revokeAll(@Param('userId',new ParseUUIDPipe({version:'4'})) userId:string,@CurrentUserId() actor:string|undefined){ const revokedCount=await this.security.revokeAllSessions({actorUserId:this.actor(actor),userId}); return {success:true as const,revokedCount}; }
  @Post('unlock') @RequirePermissions(PermissionCode.USER_MANAGE,PermissionCode.USER_SECURITY_MANAGE)
  async unlock(@Param('userId',new ParseUUIDPipe({version:'4'})) userId:string,@CurrentUserId() actor:string|undefined){ await this.security.unlock({actorUserId:this.actor(actor),userId}); return {success:true as const}; }
  @Get('security-events') @RequirePermissions(PermissionCode.USER_MANAGE,PermissionCode.USER_SECURITY_READ)
  async events(@Param('userId',new ParseUUIDPipe({version:'4'})) userId:string):Promise<readonly AdminSecurityEventResponse[]>{ return (await this.security.listSecurityEvents(userId)).map(toAdminSecurityEventResponse); }
  private actor(actor:string|undefined):string{ if(!actor)throw new AuthenticationRequiredException({code:'ADMIN_USER_SECURITY_ACTOR_REQUIRED',message:'Không xác định được quản trị viên hiện tại'}); return actor; }
}
