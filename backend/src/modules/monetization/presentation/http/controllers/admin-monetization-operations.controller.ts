import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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

import {
  GetRevenueAnalyticsQuery,
  GetRevenueAnalyticsQueryHandler,
  ListAdminPurchasesQuery,
  ListAdminPurchasesQueryHandler,
  RefundChapterPurchaseCommand,
  RefundChapterPurchaseCommandHandler,
} from '../../../application';
import { MonetizationFeatureGuard } from '../guards';
import {
  AdminPurchaseExplorerRequest,
  RefundChapterPurchaseRequest,
  RevenueAnalyticsRequest,
} from '../requests';

@Controller('admin/monetization')
@UseGuards(MonetizationFeatureGuard)
export class AdminMonetizationOperationsController {
  constructor(
    private readonly listPurchases: ListAdminPurchasesQueryHandler,
    private readonly refundPurchase: RefundChapterPurchaseCommandHandler,
    private readonly revenueAnalytics: GetRevenueAnalyticsQueryHandler,
  ) {}

  @Get('purchases')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  purchases(@Query() request: AdminPurchaseExplorerRequest) {
    return this.listPurchases.execute(
      new ListAdminPurchasesQuery(
        request.page,
        request.pageSize,
        request.status,
        request.search,
        request.userId,
        request.storyId,
        request.authorId,
        request.from,
        request.to,
      ),
    );
  }

  @Post('purchases/:purchaseId/refund')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.PAYMENT_REFUND_ADMIN)
  refund(
    @CurrentUserId() actorId: string | undefined,
    @Param('purchaseId', new ParseUUIDPipe({ version: '4' }))
    purchaseId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() request: RefundChapterPurchaseRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.refundPurchase.execute(
      new RefundChapterPurchaseCommand(
        actorId,
        purchaseId,
        request.reason,
        idempotencyKey,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }

  @Get('revenue')
  @RequirePermissions(PermissionCode.ANALYTICS_READ)
  revenue(@Query() request: RevenueAnalyticsRequest) {
    return this.revenueAnalytics.execute(
      new GetRevenueAnalyticsQuery(request.from, request.to, request.limit),
    );
  }
}
