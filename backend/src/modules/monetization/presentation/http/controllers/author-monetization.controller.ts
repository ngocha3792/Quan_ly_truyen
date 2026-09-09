import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';

import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { ActiveAuthorGuard } from '@/modules/authors';

import {
  GetChapterMonetizationQuery,
  GetChapterMonetizationQueryHandler,
  SetChapterMonetizationCommand,
  SetChapterMonetizationCommandHandler,
} from '../../../application';
import { AuthorPricingFeatureGuard } from '../guards';
import { SetChapterMonetizationRequest } from '../requests';

@Controller('author/stories/:storyId/chapters/:chapterId/monetization')
@UseGuards(AuthorPricingFeatureGuard, ActiveAuthorGuard)
@RequirePermissions(PermissionCode.CHAPTER_MONETIZATION_MANAGE_OWN)
export class AuthorMonetizationController {
  constructor(
    private readonly setChapterMonetization: SetChapterMonetizationCommandHandler,
    private readonly getChapterMonetization: GetChapterMonetizationQueryHandler,
  ) {}

  @Get()
  get(
    @CurrentUserId() actorId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
  ) {
    return this.getChapterMonetization.execute(
      new GetChapterMonetizationQuery(actorId, storyId, chapterId),
    );
  }

  @Put()
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  update(
    @CurrentUserId() actorId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Body() request: SetChapterMonetizationRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.setChapterMonetization.execute(
      new SetChapterMonetizationCommand(
        actorId,
        storyId,
        chapterId,
        request.accessType,
        request.priceBandId,
        request.unlockPolicy,
        request.freeAt ? new Date(request.freeAt) : undefined,
        request.paidWindowDays,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
