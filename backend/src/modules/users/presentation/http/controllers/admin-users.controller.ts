import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { PermissionCode, RoleCode } from '@/common/enums';

import {
  AssignManagedUserRoleCommand,
  AssignManagedUserRoleCommandHandler,
  GetManagedUserQuery,
  GetManagedUserQueryHandler,
  ListManagedUsersQuery,
  ListManagedUsersQueryHandler,
  RemoveManagedUserRoleCommand,
  RemoveManagedUserRoleCommandHandler,
  UpdateManagedUserStatusCommand,
  UpdateManagedUserStatusCommandHandler,
} from '../../../application';

import {
  AssignManagedUserRoleRequest,
  ListManagedUsersRequest,
  UpdateManagedUserStatusRequest,
} from '../requests';
import {
  type ManagedUserDetailResponse,
  type ManagedUserListResponse,
  toManagedUserDetailResponse,
  toManagedUserListResponse,
} from '../responses';

@Controller('admin/users')
@RequirePermissions(PermissionCode.USER_MANAGE)
export class AdminUsersController {
  constructor(
    private readonly listManagedUsers: ListManagedUsersQueryHandler,
    private readonly getManagedUser: GetManagedUserQueryHandler,
    private readonly updateManagedUserStatus: UpdateManagedUserStatusCommandHandler,
    private readonly assignManagedUserRole: AssignManagedUserRoleCommandHandler,
    private readonly removeManagedUserRole: RemoveManagedUserRoleCommandHandler,
  ) {}

  @Get()
  async list(
    @Query() request: ListManagedUsersRequest,
  ): Promise<ManagedUserListResponse> {
    const result = await this.listManagedUsers.execute(
      new ListManagedUsersQuery(
        request.keyword,
        request.status,
        request.role,
        request.offset,
        request.limit,
      ),
    );

    return toManagedUserListResponse(result);
  }

  @Get(':userId')
  async findOne(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<ManagedUserDetailResponse> {
    const result = await this.getManagedUser.execute(
      new GetManagedUserQuery(userId),
    );

    return toManagedUserDetailResponse(result);
  }

  @Patch(':userId/status')
  async updateStatus(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUserId() actorUserId: string | undefined,
    @Body() request: UpdateManagedUserStatusRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ManagedUserDetailResponse> {
    const result = await this.updateManagedUserStatus.execute(
      new UpdateManagedUserStatusCommand(
        actorUserId,
        userId,
        request.status,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toManagedUserDetailResponse(result);
  }

  @Post(':userId/roles')
  @RequirePermissions(PermissionCode.USER_MANAGE, PermissionCode.ROLE_MANAGE)
  async assignRole(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUserId() actorUserId: string | undefined,
    @Body() request: AssignManagedUserRoleRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ManagedUserDetailResponse> {
    const result = await this.assignManagedUserRole.execute(
      new AssignManagedUserRoleCommand(
        actorUserId,
        userId,
        request.roleCode,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toManagedUserDetailResponse(result);
  }

  @Delete(':userId/roles/:roleCode')
  @RequirePermissions(PermissionCode.USER_MANAGE, PermissionCode.ROLE_MANAGE)
  async removeRole(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('roleCode', new ParseEnumPipe(RoleCode)) roleCode: RoleCode,
    @CurrentUserId() actorUserId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ManagedUserDetailResponse> {
    const result = await this.removeManagedUserRole.execute(
      new RemoveManagedUserRoleCommand(
        actorUserId,
        userId,
        roleCode,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toManagedUserDetailResponse(result);
  }
}
