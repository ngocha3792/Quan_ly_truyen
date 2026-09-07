export const WALLET_CURRENCIES = ['CREDIT'] as const;
export type WalletCurrencyName = (typeof WALLET_CURRENCIES)[number];

export const WALLET_TRANSACTION_TYPES = [
  'TOP_UP',
  'CHAPTER_PURCHASE',
  'REFUND',
  'REVERSAL',
  'ADMIN_ADJUSTMENT',
] as const;
export type WalletTransactionTypeName =
  (typeof WALLET_TRANSACTION_TYPES)[number];

export const WALLET_SYSTEM_ACCOUNTS = [
  'PAYMENT_CLEARING',
  'PLATFORM_REVENUE',
  'ADJUSTMENT',
] as const;
export type WalletSystemAccountName = (typeof WALLET_SYSTEM_ACCOUNTS)[number];

export const WALLET_MUTATION_DIRECTIONS = ['CREDIT', 'DEBIT'] as const;
export type WalletMutationDirection =
  (typeof WALLET_MUTATION_DIRECTIONS)[number];

export const MAX_WALLET_CREDIT_AMOUNT = 9_000_000_000_000_000n;
