import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ClientIp,
  CurrentUserId,
  Public,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';

import {
  ListMyPurchasesQuery,
  ListMyPurchasesQueryHandler,
  ListPriceBandsQuery,
  ListPriceBandsQueryHandler,
  UnlockChapterCommand,
  UnlockChapterCommandHandler,
  MONETIZATION_RATE_LIMITER_PORT,
  type MonetizationRateLimiterPort,
} from '../../../application';
import { MonetizationFeatureGuard } from '../guards';
import { ListPurchasesRequest } from '../requests';

@Controller('monetization')
@UseGuards(MonetizationFeatureGuard)
export class ReaderMonetizationController {
  constructor(
    private readonly listPriceBands: ListPriceBandsQueryHandler,
    private readonly unlockChapter: UnlockChapterCommandHandler,
    private readonly listPurchases: ListMyPurchasesQueryHandler,
    @Inject(MONETIZATION_RATE_LIMITER_PORT)
    private readonly rateLimiter: MonetizationRateLimiterPort,
  ) {}

  @Get('price-bands')
  @Public()
  listActivePriceBands() {
    return this.listPriceBands.execute(new ListPriceBandsQuery(true));
  }

  @Get('purchases/me')
  @RequirePermissions(PermissionCode.PURCHASE_READ_SELF)
  listMyPurchaseHistory(
    @CurrentUserId() userId: string | undefined,
    @Query() request: ListPurchasesRequest,
  ) {
    return this.listPurchases.execute(
      new ListMyPurchasesQuery(userId, request.page, request.pageSize),
    );
  }

  @Post('chapters/:chapterId/unlock')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.PURCHASE_CREATE_SELF)
  async unlock(
    @CurrentUserId() userId: string | undefined,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    await this.rateLimiter.consume({
      operation: 'chapter_unlock',
      subject: `user:${userId ?? 'missing'}`,
    });
    if (ipAddress) {
      await this.rateLimiter.consume({
        operation: 'chapter_unlock',
        subject: `ip:${ipAddress}`,
      });
    }
    return this.unlockChapter.execute(
      new UnlockChapterCommand(
        userId,
        chapterId,
        idempotencyKey,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
