import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  DeleteRatingCommand,
  DeleteRatingCommandHandler,
  GetMyRatingQuery,
  GetMyRatingQueryHandler,
  UpsertRatingCommand,
  UpsertRatingCommandHandler,
  type StoryRatingResultDto,
} from '../../../application';
import { UpsertRatingRequest } from '../requests';

@Controller()
export class RatingsController {
  constructor(
    private readonly getMyRatingQuery: GetMyRatingQueryHandler,
    private readonly upsertRatingCommand: UpsertRatingCommandHandler,
    private readonly deleteRatingCommand: DeleteRatingCommandHandler,
  ) {}

  @Get('stories/:storyId/rating/me')
  @RequirePermissions(PermissionCode.RATING_CREATE)
  getMyRating(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<StoryRatingResultDto | null> {
    return this.getMyRatingQuery.execute(new GetMyRatingQuery(userId, storyId));
  }

  @Put('stories/:storyId/rating')
  @RequirePermissions(
    PermissionCode.RATING_CREATE,
    PermissionCode.RATING_UPDATE_OWN,
  )
  upsertRating(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpsertRatingRequest,
  ): Promise<StoryRatingResultDto> {
    return this.upsertRatingCommand.execute(
      new UpsertRatingCommand(userId, storyId, request.score),
    );
  }

  @Delete('stories/:storyId/rating')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.RATING_UPDATE_OWN)
  async deleteRating(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<void> {
    await this.deleteRatingCommand.execute(
      new DeleteRatingCommand(userId, storyId),
    );
  }
}
