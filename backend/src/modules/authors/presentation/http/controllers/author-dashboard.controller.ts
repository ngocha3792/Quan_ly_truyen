import { Controller, Get, UnauthorizedException } from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  GetAuthorDashboardQuery,
  GetAuthorDashboardQueryHandler,
} from '../../../application/queries';

import type { AuthorDashboardDto } from '../../../application/dto';

@Controller('author/dashboard')
@RequirePermissions(PermissionCode.STORY_CREATE)
export class AuthorDashboardController {
  constructor(
    private readonly getDashboardHandler: GetAuthorDashboardQueryHandler,
  ) {}

  @Get()
  dashboard(
    @CurrentUserId() userId: string | undefined,
  ): Promise<AuthorDashboardDto> {
    return this.getDashboardHandler.execute(
      new GetAuthorDashboardQuery(this.requireUserId(userId)),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return userId;
  }
}
