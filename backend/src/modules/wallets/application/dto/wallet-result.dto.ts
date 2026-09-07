import type {
  WalletCurrencyName,
  WalletMutationDirection,
  WalletTransactionTypeName,
} from '../../domain';

export interface WalletBalanceResultDto {
  readonly currency: WalletCurrencyName;
  readonly availableBalance: string;
  readonly version: number;
  readonly updatedAt: string | null;
}

export interface WalletTransactionResultDto {
  readonly id: string;
  readonly currency: WalletCurrencyName;
  readonly type: WalletTransactionTypeName;
  readonly direction: WalletMutationDirection;
  readonly amount: string;
  readonly balanceAfter: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly createdAt: string;
}

export interface WalletTransactionPageResultDto {
  readonly items: readonly WalletTransactionResultDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface WalletMutationResultDto {
  readonly transaction: WalletTransactionResultDto;
  readonly replayed: boolean;
}

export interface WalletReconciliationResultDto {
  readonly userId: string;
  readonly currency: WalletCurrencyName;
  readonly materializedBalance: string;
  readonly ledgerBalance: string;
  readonly transactionCount: number;
  readonly balancedTransactionCount: number;
  readonly isConsistent: boolean;
}
