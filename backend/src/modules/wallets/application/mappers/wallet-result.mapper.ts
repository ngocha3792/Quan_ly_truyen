import type {
  WalletBalanceResultDto,
  WalletMutationResultDto,
  WalletReconciliationResultDto,
  WalletTransactionPageResultDto,
  WalletTransactionResultDto,
} from '../dto';
import type {
  PostWalletTransactionRecord,
  WalletBalanceRecord,
  WalletReconciliationRecord,
  WalletTransactionPageRecord,
  WalletTransactionRecord,
} from '../ports';

export function toWalletBalanceResult(
  record: WalletBalanceRecord,
): WalletBalanceResultDto {
  return {
    currency: record.currency,
    availableBalance: record.balance.toString(),
    version: record.version,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export function toWalletTransactionResult(
  record: WalletTransactionRecord,
): WalletTransactionResultDto {
  const direction = record.walletAmount > 0n ? 'CREDIT' : 'DEBIT';
  const amount =
    record.walletAmount < 0n ? -record.walletAmount : record.walletAmount;

  return {
    id: record.id,
    currency: record.currency,
    type: record.type,
    direction,
    amount: amount.toString(),
    balanceAfter: record.walletBalanceAfter.toString(),
    referenceType: record.referenceType,
    referenceId: record.referenceId,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toWalletTransactionPageResult(
  record: WalletTransactionPageRecord,
): WalletTransactionPageResultDto {
  return {
    items: record.items.map(toWalletTransactionResult),
    page: record.page,
    pageSize: record.pageSize,
    total: record.total,
  };
}

export function toWalletMutationResult(
  record: PostWalletTransactionRecord,
): WalletMutationResultDto {
  return {
    transaction: toWalletTransactionResult(record.transaction),
    replayed: record.replayed,
  };
}

export function toWalletReconciliationResult(
  record: WalletReconciliationRecord,
): WalletReconciliationResultDto {
  return {
    userId: record.userId,
    currency: record.currency,
    materializedBalance: record.materializedBalance.toString(),
    ledgerBalance: record.ledgerBalance.toString(),
    transactionCount: record.transactionCount,
    balancedTransactionCount: record.balancedTransactionCount,
    isConsistent:
      record.materializedBalance === record.ledgerBalance &&
      record.transactionCount === record.balancedTransactionCount,
  };
}
