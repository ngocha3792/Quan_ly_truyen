import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ClientIp,
  CurrentUserId,
  Idempotent,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { TagsService } from '../../../application';
import {
  CreateTagRequest,
  ListAdminTagsRequest,
  MergeTagRequest,
  UpdateTagRequest,
} from '../requests';

@Controller('admin/tags')
@RequirePermissions(PermissionCode.TAG_MANAGE)
export class AdminTagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@Query() request: ListAdminTagsRequest) {
    return this.tags.list(request);
  }

  @Post()
  create(
    @Body() request: CreateTagRequest,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.tags.create(request.name, {
      actorId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Patch(':tagId')
  update(
    @Param('tagId', new ParseUUIDPipe({ version: '4' })) tagId: string,
    @Body() request: UpdateTagRequest,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.tags.update(tagId, request.name, {
      actorId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Delete(':tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tagId', new ParseUUIDPipe({ version: '4' })) tagId: string,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<void> {
    await this.tags.delete(tagId, {
      actorId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Post(':sourceTagId/merge')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  merge(
    @Param('sourceTagId', new ParseUUIDPipe({ version: '4' }))
    sourceTagId: string,
    @Body() request: MergeTagRequest,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.tags.merge(sourceTagId, request.targetTagId, {
      actorId,
      ipAddress,
      userAgent,
      requestId,
    });
  }
}
