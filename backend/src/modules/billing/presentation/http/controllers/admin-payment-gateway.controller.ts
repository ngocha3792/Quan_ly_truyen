import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import { BillingGatewayManager } from '../../../application/commands/gateway-operations/billing-gateway.manager';
import { BillingOperationsFeatureGuard } from '../guards';
import { RefundPaymentOrderRequest } from '../requests/refund-payment-order.request';

@Controller('admin/billing/payment-orders')
@UseGuards(BillingOperationsFeatureGuard)
export class AdminPaymentGatewayController {
  constructor(private readonly manager: BillingGatewayManager) {}

  @Post(':orderId/reconcile')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.PAYMENT_RECONCILE_ADMIN)
  reconcile(
    @CurrentUserId() actorId: string | undefined,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.manager.reconcile(actorId, orderId);
  }

  @Get(':orderId/refunds')
  @RequirePermissions(PermissionCode.PAYMENT_REFUND_ADMIN)
  list(
    @CurrentUserId() actorId: string | undefined,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.manager.listRefunds(actorId, orderId);
  }

  @Post(':orderId/refunds')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.PAYMENT_REFUND_ADMIN)
  refund(
    @CurrentUserId() actorId: string | undefined,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RefundPaymentOrderRequest,
  ) {
    return this.manager.refund({
      actorId,
      orderId,
      idempotencyKey,
      reason: input.reason,
    });
  }
}
