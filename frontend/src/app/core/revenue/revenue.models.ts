export type EarningStatus = 'PENDING' | 'AVAILABLE' | 'RESERVED' | 'PAID';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type PayoutMethod = 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY';

export interface RevenuePolicy {
  readonly version: number;
  readonly enabled: boolean;
  readonly settlementDelayDays: number;
  readonly minimumPayoutCredits: string;
  readonly feeBasisPoints: number;
  readonly taxBasisPoints: number;
  readonly fiatMinorPerCredit: string;
  readonly currency: 'VND';
  readonly minimumPlatformFeeBasisPoints: number;
  readonly platformUserId: string | null;
}

export interface AuthorRevenueSummary {
  readonly available: string;
  readonly pending: string;
  readonly reserved: string;
  readonly paid: string;
  readonly policy: RevenuePolicy;
  readonly items: readonly AuthorEarningEntry[];
}

export interface AuthorEarningEntry {
  readonly id: string;
  readonly amount: string;
  readonly status: EarningStatus;
  readonly settlementDate: string;
  readonly availableAt: string | null;
  readonly createdAt: string;
}

export interface PayoutAccount {
  readonly id: string;
  readonly userId?: string;
  readonly method: PayoutMethod;
  readonly bankName: string | null;
  readonly accountNumberMasked: string | null;
  readonly accountName: string | null;
  readonly walletPhoneMasked: string | null;
  readonly isVerified: boolean;
  readonly isPrimary: boolean;
  readonly isActive: boolean;
  readonly kycReference: string | null;
}

export interface PayoutRequest {
  readonly id: string;
  readonly userId?: string;
  readonly batchId?: string | null;
  readonly grossAmount: string;
  readonly feeAmount: string;
  readonly taxAmount: string;
  readonly netAmount: string;
  readonly fiatMinorPerCredit: string;
  readonly fiatAmountMinor: string;
  readonly status: PayoutStatus;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly failureReason: string | null;
}

export interface CreatePayoutAccountInput {
  method: PayoutMethod;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  walletPhone?: string;
  kycReference: string;
}

export interface PayoutBatch {
  readonly id: string;
  readonly batchNumber: string;
  readonly totalRequests: number;
  readonly totalAmount: string;
  readonly status: string;
  readonly createdAt: string;
}

export function formatCredits(value: string): string {
  return new Intl.NumberFormat('vi-VN').format(BigInt(value));
}

export function quotePayout(amount: string, policy: RevenuePolicy) {
  if (!/^[1-9]\d*$/u.test(amount) || !/^[1-9]\d*$/u.test(policy.fiatMinorPerCredit)) return null;
  const gross = BigInt(amount);
  const fee = (gross * BigInt(policy.feeBasisPoints)) / 10_000n;
  const tax = (gross * BigInt(policy.taxBasisPoints)) / 10_000n;
  const net = gross - fee - tax;
  return {
    gross: gross.toString(),
    fee: fee.toString(),
    tax: tax.toString(),
    net: net.toString(),
    vnd: (net * BigInt(policy.fiatMinorPerCredit)).toString(),
  };
}
