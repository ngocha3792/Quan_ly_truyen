import type {
  WalletCurrencyName,
  WalletSystemAccountName,
  WalletTransactionTypeName,
} from '../../domain';

export const WALLET_PERSISTENCE_PORT = Symbol('WALLET_PERSISTENCE_PORT');

export type WalletMetadata = Readonly<
  Record<string, string | number | boolean | null>
>;

export interface WalletBalanceRecord {
  readonly userId: string;
  readonly currency: WalletCurrencyName;
  readonly balance: bigint;
  readonly version: number;
  readonly updatedAt: Date | null;
}

export interface WalletTransactionRecord {
  readonly id: string;
  readonly currency: WalletCurrencyName;
  readonly type: WalletTransactionTypeName;
  readonly walletAmount: bigint;
  readonly walletBalanceAfter: bigint;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly createdAt: Date;
}

export interface WalletTransactionPageRecord {
  readonly items: readonly WalletTransactionRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface PostWalletTransactionInput {
  readonly userId: string;
  readonly currency: WalletCurrencyName;
  readonly type: WalletTransactionTypeName;
  readonly walletAmount: bigint;
  readonly systemAccount: WalletSystemAccountName;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly metadata?: WalletMetadata;
  readonly audit?: {
    readonly actorId: string;
    readonly reason: string;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
  };
}

export interface PostWalletTransactionRecord {
  readonly transaction: WalletTransactionRecord;
  readonly replayed: boolean;
}

export interface WalletReconciliationRecord {
  readonly userId: string;
  readonly currency: WalletCurrencyName;
  readonly materializedBalance: bigint;
  readonly ledgerBalance: bigint;
  readonly transactionCount: number;
  readonly balancedTransactionCount: number;
}

export interface WalletPersistencePort {
  findBalance(
    userId: string,
    currency: WalletCurrencyName,
  ): Promise<WalletBalanceRecord>;

  listTransactions(input: {
    userId: string;
    currency: WalletCurrencyName;
    page: number;
    pageSize: number;
  }): Promise<WalletTransactionPageRecord>;

  postTransaction(
    input: PostWalletTransactionInput,
  ): Promise<PostWalletTransactionRecord>;

  reconcile(
    userId: string,
    currency: WalletCurrencyName,
  ): Promise<WalletReconciliationRecord>;
}
