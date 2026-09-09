import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId, Public, RequirePermissions } from '@/common/decorators';
import { OptionalJwtAuthGuard } from '@/common/guards';
import { PermissionCode } from '@/common/enums';
import { SearchQueryHandler } from '../../../application/queries/search.query-handler';
import { RebuildSearchCommandHandler } from '../../../application/commands/rebuild-search.command-handler';
import { SearchRequest } from '../requests/search.request';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchQueryHandler) {}
  @Get('filters')
  @Public()
  filters() {
    return this.search.filters();
  }
  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  query(@Query() request: SearchRequest, @CurrentUserId() viewerId?: string) {
    return this.search.execute(request, viewerId);
  }
}

@Controller('admin/search')
@RequirePermissions(PermissionCode.SEARCH_MANAGE)
export class AdminSearchController {
  constructor(private readonly rebuild: RebuildSearchCommandHandler) {}
  @Post('rebuild')
  @HttpCode(202)
  requestRebuild() {
    return this.rebuild.execute();
  }
  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  status() {
    return this.rebuild.status();
  }
}
