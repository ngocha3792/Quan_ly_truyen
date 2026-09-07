import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  ListCreditPackagesQuery,
  ListCreditPackagesQueryHandler,
  ReconcilePaymentsQueryHandler,
  UpdateCreditPackageCommand,
  UpdateCreditPackageCommandHandler,
} from '../../../application';
import { PaymentProviderFeatureGuard } from '../guards';
import { UpdateCreditPackageRequest } from '../requests';

@Controller('admin/billing')
@UseGuards(PaymentProviderFeatureGuard)
export class AdminBillingController {
  constructor(
    private readonly listPackages: ListCreditPackagesQueryHandler,
    private readonly updatePackage: UpdateCreditPackageCommandHandler,
    private readonly reconcilePayments: ReconcilePaymentsQueryHandler,
  ) {}

  @Get('credit-packages')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  packages() {
    return this.listPackages.execute(new ListCreditPackagesQuery(false));
  }

  @Patch('credit-packages/:packageId')
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
  @RequirePermissions(PermissionCode.PAYMENT_RECONCILE_ADMIN)
  reconcile() {
    return this.reconcilePayments.execute();
  }
}
