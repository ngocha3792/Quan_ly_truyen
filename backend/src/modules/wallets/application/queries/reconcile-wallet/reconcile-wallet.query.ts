import type { WalletCurrencyName } from '../../../domain';

export class ReconcileWalletQuery {
  constructor(
    public readonly userId: string,
    public readonly currency: WalletCurrencyName = 'CREDIT',
  ) {}
}
