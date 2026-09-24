export interface RevenueAgreementInput {
  readonly storyId: string;
  readonly authorShareBps: number;
  readonly platformFeeBps: number;
  readonly contributorShares: readonly { userId: string; shareBps: number }[];
  readonly effectiveFrom?: string;
}
export interface RevenueAgreement extends RevenueAgreementInput {
  readonly id: string;
  readonly version: number;
  readonly authorUserId: string;
  readonly effectiveTo: string | null;
  readonly approvedBy: string;
  readonly approvedAt: string;
}
export interface RevenueReconciliation {
  readonly purchaseGrossCredits: string;
  readonly allocatedGrossCredits: string;
  readonly refundedCredits: string;
  readonly earningsCredits: string;
  readonly paidCredits: string;
  readonly differenceCredits: string;
  readonly generatedAt: string;
}
