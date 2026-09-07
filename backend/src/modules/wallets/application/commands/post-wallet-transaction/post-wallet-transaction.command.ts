import type {
  WalletCurrencyName,
  WalletMutationDirection,
  WalletSystemAccountName,
  WalletTransactionTypeName,
} from '../../../domain';
import type { PostWalletTransactionInput, WalletMetadata } from '../../ports';

export class PostWalletTransactionCommand {
  constructor(
    public readonly userId: string,
    public readonly currency: WalletCurrencyName,
    public readonly type: WalletTransactionTypeName,
    public readonly direction: WalletMutationDirection,
    public readonly amount: bigint,
    public readonly systemAccount: WalletSystemAccountName,
    public readonly idempotencyKey: string,
    public readonly referenceType: string,
    public readonly referenceId: string,
    public readonly metadata?: WalletMetadata,
    public readonly audit?: PostWalletTransactionInput['audit'],
  ) {}
}
