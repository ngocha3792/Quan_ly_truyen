export const REVENUE_PAYOUT_PORT = Symbol('REVENUE_PAYOUT_PORT');

export interface RevenuePolicyInput {
  enabled: boolean;
  settlementDelayDays: number;
  minimumPayoutCredits: string;
  feeBasisPoints: number;
  taxBasisPoints: number;
  fiatMinorPerCredit: string;
  minimumPlatformFeeBasisPoints: number;
  platformUserId?: string;
}
export interface PayoutAccountInput {
  method: 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY';
  bankName?: string;
  accountNumber?: string;
  accountName: string;
  walletPhone?: string;
  kycReference: string;
}
export interface RevenuePayoutPort {
  getPolicy(): Promise<unknown>;
  updatePolicy(actorId: string, input: RevenuePolicyInput): Promise<unknown>;
  getEarnings(userId: string): Promise<unknown>;
  listAccounts(userId?: string): Promise<unknown>;
  createAccount(userId: string, input: PayoutAccountInput): Promise<unknown>;
  updateAccount(
    userId: string,
    id: string,
    input: { isActive?: boolean; isPrimary?: boolean },
  ): Promise<unknown>;
  reviewAccount(
    actorId: string,
    id: string,
    input: { verified: boolean; reference: string },
  ): Promise<unknown>;
  listRequests(userId?: string): Promise<unknown>;
  createRequest(
    userId: string,
    accountId: string,
    grossAmount: string,
    idempotencyKey: string,
  ): Promise<unknown>;
  cancelRequest(userId: string, id: string): Promise<unknown>;
  listBatches(): Promise<unknown>;
  createBatch(actorId: string, requestIds: readonly string[]): Promise<unknown>;
  exportBatch(actorId: string, id: string): Promise<unknown>;
  completeRequest(
    actorId: string,
    id: string,
    input: { providerTxnId: string; evidenceReference: string },
  ): Promise<unknown>;
  failRequest(
    actorId: string,
    id: string,
    input: { reason: string; evidenceReference: string },
  ): Promise<unknown>;
  reconcile(): Promise<unknown>;
}
