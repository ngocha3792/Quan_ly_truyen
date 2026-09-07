import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { ServiceUnavailableException } from '@/common/exceptions';
import { billingConfig, monetizationConfig } from '@/config';

@Injectable()
export class PaymentProviderFeatureGuard implements CanActivate {
  constructor(
    @Inject(monetizationConfig.KEY)
    private readonly monetization: ConfigType<typeof monetizationConfig>,
    @Inject(billingConfig.KEY)
    private readonly billing: ConfigType<typeof billingConfig>,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    void _context;
    if (
      !this.monetization.enabled ||
      !this.monetization.paymentProviderEnabled ||
      this.billing.providerMode === 'disabled'
    ) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_DISABLED',
        message: 'Nạp Credit hiện chưa được bật',
        service: 'payment-provider',
      });
    }
    return true;
  }
}

@Injectable()
export class BillingOperationsFeatureGuard implements CanActivate {
  constructor(
    @Inject(monetizationConfig.KEY)
    private readonly monetization: ConfigType<typeof monetizationConfig>,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    void _context;
    if (!this.monetization.enabled) {
      throw new ServiceUnavailableException({
        code: 'MONETIZATION_DISABLED',
        message: 'Tính năng Credit hiện chưa được bật',
      });
    }
    return true;
  }
}
