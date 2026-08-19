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
import {
  CreateCategoryCommand,
  CreateCategoryCommandHandler,
  DeleteCategoryCommand,
  DeleteCategoryCommandHandler,
  ListCategoriesQuery,
  ListCategoriesQueryHandler,
  UpdateCategoryCommand,
  UpdateCategoryCommandHandler,
} from '../../../application';
import {
  CreateCategoryRequest,
  ListAdminCategoriesRequest,
  UpdateCategoryRequest,
} from '../requests';

@Controller('admin/categories')
@RequirePermissions(PermissionCode.CATEGORY_MANAGE)
export class AdminCategoriesController {
  constructor(
    private readonly listCategories: ListCategoriesQueryHandler,
    private readonly createCategory: CreateCategoryCommandHandler,
    private readonly updateCategory: UpdateCategoryCommandHandler,
    private readonly deleteCategory: DeleteCategoryCommandHandler,
  ) {}

  @Get()
  list(@Query() request: ListAdminCategoriesRequest) {
    return this.listCategories.execute(new ListCategoriesQuery(request));
  }

  @Post()
  create(
    @Body() request: CreateCategoryRequest,
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.createCategory.execute(
      new CreateCategoryCommand(request, {
        actorId,
        ipAddress,
        userAgent,
        requestId,
      }),
    );
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
    return this.updateCategory.execute(
      new UpdateCategoryCommand(categoryId, request, {
        actorId,
        ipAddress,
        userAgent,
        requestId,
      }),
    );
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
    await this.deleteCategory.execute(
      new DeleteCategoryCommand(categoryId, {
        actorId,
        ipAddress,
        userAgent,
        requestId,
      }),
    );
  }
}
