import { Injectable } from '@nestjs/common';

import type {
  PaymentProviderAdapter,
  PaymentProviderRegistryPort,
} from '../../application';
import type { PaymentProviderKindName } from '../../domain';
import { PaymentProviderKindUnsupportedException } from '../../domain';
import { HmacSandboxPaymentProviderAdapter } from './hmac-sandbox-provider.adapter';
import { ManualBankTransferProviderAdapter } from './manual-bank-transfer-provider.adapter';
import { VnpayPaymentProviderAdapter } from './vnpay-provider.adapter';

@Injectable()
export class PaymentProviderRegistry implements PaymentProviderRegistryPort {
  private readonly adapters: ReadonlyMap<
    PaymentProviderKindName,
    PaymentProviderAdapter
  >;

  constructor(
    manual: ManualBankTransferProviderAdapter,
    sandbox: HmacSandboxPaymentProviderAdapter,
    vnpay: VnpayPaymentProviderAdapter,
  ) {
    this.adapters = new Map<PaymentProviderKindName, PaymentProviderAdapter>([
      [manual.kind, manual],
      [sandbox.kind, sandbox],
      [vnpay.kind, vnpay],
    ]);
  }

  getAdapter(kind: PaymentProviderKindName): PaymentProviderAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) throw new PaymentProviderKindUnsupportedException(kind);
    return adapter;
  }

  listKinds(): readonly PaymentProviderKindName[] {
    return [...this.adapters.keys()];
  }
}
