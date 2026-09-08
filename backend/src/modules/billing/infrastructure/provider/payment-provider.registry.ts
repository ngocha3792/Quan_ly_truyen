import { Injectable } from '@nestjs/common';

import type {
  PaymentProviderAdapter,
  PaymentProviderRegistryPort,
} from '../../application';
import type { PaymentProviderKindName } from '../../domain';
import { PaymentProviderKindUnsupportedException } from '../../domain';
import { HmacSandboxPaymentProviderAdapter } from './hmac-sandbox-provider.adapter';
import { ManualBankTransferProviderAdapter } from './manual-bank-transfer-provider.adapter';

@Injectable()
export class PaymentProviderRegistry implements PaymentProviderRegistryPort {
  private readonly adapters: ReadonlyMap<
    PaymentProviderKindName,
    PaymentProviderAdapter
  >;

  constructor(
    manual: ManualBankTransferProviderAdapter,
    sandbox: HmacSandboxPaymentProviderAdapter,
  ) {
    this.adapters = new Map<PaymentProviderKindName, PaymentProviderAdapter>([
      [manual.kind, manual],
      [sandbox.kind, sandbox],
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
