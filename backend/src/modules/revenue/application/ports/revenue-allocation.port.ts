export const REVENUE_ALLOCATION_PORT = Symbol('REVENUE_ALLOCATION_PORT');

export interface CreateRevenueAgreementInput {
  readonly actorId: string;
  readonly storyId: string;
  readonly authorShareBps: number;
  readonly platformFeeBps: number;
  readonly contributorShares?: readonly {
    readonly userId: string;
    readonly shareBps: number;
  }[];
  readonly effectiveFrom?: string;
  readonly idempotencyKey: string;
}

export interface RevenueAgreementView {
  readonly id: string;
  readonly storyId: string;
  readonly version: number;
  readonly authorUserId: string;
  readonly authorShareBps: number;
  readonly platformFeeBps: number;
  readonly contributorShares: readonly {
    readonly userId: string;
    readonly shareBps: number;
  }[];
  readonly platformUserId: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
}

export interface RevenueAllocationPort {
  createAgreement(
    input: CreateRevenueAgreementInput,
  ): Promise<RevenueAgreementView>;
  listAgreements(
    storyId: string,
    userId?: string,
  ): Promise<readonly RevenueAgreementView[]>;
  settlePending(limit?: number): Promise<{ settled: number }>;
}
