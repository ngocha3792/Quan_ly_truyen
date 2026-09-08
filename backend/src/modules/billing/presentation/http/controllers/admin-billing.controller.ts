import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ListCreditPackagesQuery,
  ListCreditPackagesQueryHandler,
  ListAdminPaymentOrdersQuery,
  ListAdminPaymentOrdersQueryHandler,
  ReconcilePaymentsQueryHandler,
  UpdateCreditPackageCommand,
  UpdateCreditPackageCommandHandler,
  ConfirmManualPaymentOrderCommand,
  ConfirmManualPaymentOrderCommandHandler,
  RejectManualPaymentOrderCommand,
  RejectManualPaymentOrderCommandHandler,
} from '../../../application';
import {
  BillingOperationsFeatureGuard,
  PaymentProviderFeatureGuard,
} from '../guards';
import {
  AdminPaymentOrderExplorerRequest,
  UpdateCreditPackageRequest,
  ManualPaymentReviewRequest,
} from '../requests';

@Controller('admin/billing')
@UseGuards(BillingOperationsFeatureGuard)
export class AdminBillingController {
  constructor(
    private readonly listPackages: ListCreditPackagesQueryHandler,
    private readonly updatePackage: UpdateCreditPackageCommandHandler,
    private readonly reconcilePayments: ReconcilePaymentsQueryHandler,
    private readonly listPaymentOrders: ListAdminPaymentOrdersQueryHandler,
    private readonly confirmManualOrder: ConfirmManualPaymentOrderCommandHandler,
    private readonly rejectManualOrder: RejectManualPaymentOrderCommandHandler,
  ) {}

  @Get('credit-packages')
  @UseGuards(PaymentProviderFeatureGuard)
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  packages() {
    return this.listPackages.execute(new ListCreditPackagesQuery(false));
  }

  @Patch('credit-packages/:packageId')
  @UseGuards(PaymentProviderFeatureGuard)
  @RequirePermissions(PermissionCode.PAYMENT_PACKAGE_MANAGE_ADMIN)
  update(
    @CurrentUserId() actorId: string | undefined,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Body() request: UpdateCreditPackageRequest,
  ) {
    return this.updatePackage.execute(
      new UpdateCreditPackageCommand(
        actorId,
        packageId,
        request.label,
        request.creditAmount,
        request.fiatAmountMinor,
        request.currency,
        request.isActive,
        request.sortOrder,
      ),
    );
  }

  @Get('reconciliation')
  @UseGuards(PaymentProviderFeatureGuard)
  @RequirePermissions(PermissionCode.PAYMENT_RECONCILE_ADMIN)
  reconcile() {
    return this.reconcilePayments.execute();
  }

  @Get('payment-orders')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  orders(@Query() request: AdminPaymentOrderExplorerRequest) {
    return this.listPaymentOrders.execute(
      new ListAdminPaymentOrdersQuery(
        request.page,
        request.pageSize,
        request.status,
        request.provider,
        request.search,
        request.from,
        request.to,
      ),
    );
  }

  @Post('payment-orders/:orderId/confirm')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  confirm(
    @CurrentUserId() actorId: string | undefined,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() request: ManualPaymentReviewRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.confirmManualOrder.execute(
      new ConfirmManualPaymentOrderCommand(
        actorId,
        orderId,
        request.reason,
        idempotencyKey,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }

  @Post('payment-orders/:orderId/reject')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  reject(
    @CurrentUserId() actorId: string | undefined,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() request: ManualPaymentReviewRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.rejectManualOrder.execute(
      new RejectManualPaymentOrderCommand(
        actorId,
        orderId,
        request.reason,
        idempotencyKey,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
