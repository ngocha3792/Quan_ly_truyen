import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ClientIp, CurrentUserId, RequestId, RequirePermissions, UserAgent } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { AuthenticationRequiredException } from '@/common/exceptions';
import { AuthorLifecycleService } from '../../../application/services';
import { ListAdminAuthorsRequest, UpdateAuthorStatusRequest } from '../requests';
import type { AdminAuthorDetailResponse, AdminAuthorListResponse } from '../responses';

@Controller('admin/authors')
@RequirePermissions(PermissionCode.AUTHOR_READ)
export class AdminAuthorsController {
  constructor(private readonly lifecycle: AuthorLifecycleService) {}
  @Get()
  list(@Query() request: ListAdminAuthorsRequest): Promise<AdminAuthorListResponse> {
    return this.lifecycle.list({ search: request.search, status: request.status, createdFrom: request.createdFrom ? new Date(request.createdFrom) : undefined, createdTo: request.createdTo ? new Date(request.createdTo) : undefined, page: request.page, pageSize: request.pageSize });
  }
  @Get(':authorId')
  detail(@Param('authorId', new ParseUUIDPipe({ version: '4' })) authorId: string): Promise<AdminAuthorDetailResponse> { return this.lifecycle.detail(authorId); }
  @Patch(':authorId/status')
  @RequirePermissions(PermissionCode.AUTHOR_READ, PermissionCode.AUTHOR_STATUS_MANAGE)
  changeStatus(@Param('authorId', new ParseUUIDPipe({ version: '4' })) authorId: string, @CurrentUserId() actorUserId: string | undefined, @Body() request: UpdateAuthorStatusRequest,
    @ClientIp() ipAddress: string | undefined, @UserAgent() userAgent: string | undefined, @RequestId() requestId: string | undefined): Promise<AdminAuthorDetailResponse> {
    if (!actorUserId) throw new AuthenticationRequiredException({ code: 'AUTHOR_ADMIN_ACTOR_REQUIRED', message: 'Không xác định được quản trị viên hiện tại' });
    return this.lifecycle.changeStatus({ actorUserId, authorId, status: request.status, reason: request.reason, ipAddress, userAgent, requestId });
  }
}
