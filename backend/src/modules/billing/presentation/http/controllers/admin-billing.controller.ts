import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  ListCreditPackagesQuery,
  ListCreditPackagesQueryHandler,
  ListAdminPaymentOrdersQuery,
  ListAdminPaymentOrdersQueryHandler,
  ReconcilePaymentsQueryHandler,
  UpdateCreditPackageCommand,
  UpdateCreditPackageCommandHandler,
} from '../../../application';
import {
  BillingOperationsFeatureGuard,
  PaymentProviderFeatureGuard,
} from '../guards';
import {
  AdminPaymentOrderExplorerRequest,
  UpdateCreditPackageRequest,
} from '../requests';

@Controller('admin/billing')
@UseGuards(BillingOperationsFeatureGuard)
export class AdminBillingController {
  constructor(
    private readonly listPackages: ListCreditPackagesQueryHandler,
    private readonly updatePackage: UpdateCreditPackageCommandHandler,
    private readonly reconcilePayments: ReconcilePaymentsQueryHandler,
    private readonly listPaymentOrders: ListAdminPaymentOrdersQueryHandler,
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
}
