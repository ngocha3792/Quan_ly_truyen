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
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { CategoriesService } from '../../../application';
import {
  CreateCategoryRequest,
  ListAdminCategoriesRequest,
  UpdateCategoryRequest,
} from '../requests';

@Controller('admin/categories')
@RequirePermissions(PermissionCode.CATEGORY_MANAGE)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@Query() request: ListAdminCategoriesRequest) {
    return this.categories.list(request);
  }

  @Post()
  create(
    @Body() request: CreateCategoryRequest,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.categories.create(request, {
      actorId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Patch(':categoryId')
  update(
    @Param('categoryId', new ParseUUIDPipe({ version: '4' }))
    categoryId: string,
    @Body() request: UpdateCategoryRequest,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.categories.update(categoryId, request, {
      actorId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Delete(':categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('categoryId', new ParseUUIDPipe({ version: '4' }))
    categoryId: string,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<void> {
    await this.categories.delete(categoryId, {
      actorId,
      ipAddress,
      userAgent,
      requestId,
    });
  }
}
