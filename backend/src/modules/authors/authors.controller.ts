import { Controller, Get, Param } from '@nestjs/common';

import { CurrentUserId, Public, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  type AuthorDetailViewResponse,
  type AuthorDirectoryViewResponse,
  type AuthorStudioDashboardResponse,
  AuthorsService,
} from './authors.service';

@Controller('authors')
@Public()
export class PublicAuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  directory(): Promise<AuthorDirectoryViewResponse> {
    return this.authors.getDirectory();
  }

  @Get(':slug')
  detail(@Param('slug') slug: string): Promise<AuthorDetailViewResponse> {
    return this.authors.getDetail(slug);
  }
}

@Controller('author/dashboard')
@RequirePermissions(PermissionCode.STORY_CREATE)
export class AuthorDashboardController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  dashboard(
    @CurrentUserId() userId: string | undefined,
  ): Promise<AuthorStudioDashboardResponse> {
    return this.authors.getDashboard(userId);
  }
}
