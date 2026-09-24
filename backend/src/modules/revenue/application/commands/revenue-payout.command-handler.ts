import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  REVENUE_PAYOUT_PORT,
  RevenuePayoutPort,
  RevenuePolicyInput,
  PayoutAccountInput,
} from '../ports/revenue-payout.persistence.port';

@Injectable()
export class RevenuePayoutCommandHandler {
  constructor(
    @Inject(REVENUE_PAYOUT_PORT)
    private readonly persistence: RevenuePayoutPort,
  ) {}
  private actor(value?: string): string {
    if (!value) throw new UnauthorizedException();
    return value;
  }
  updatePolicy(actorId: string | undefined, input: RevenuePolicyInput) {
    return this.persistence.updatePolicy(this.actor(actorId), input);
  }
  createAccount(userId: string | undefined, input: PayoutAccountInput) {
    return this.persistence.createAccount(this.actor(userId), input);
  }
  updateAccount(
    userId: string | undefined,
    id: string,
    input: { isActive?: boolean; isPrimary?: boolean },
  ) {
    return this.persistence.updateAccount(this.actor(userId), id, input);
  }
  reviewAccount(
    actorId: string | undefined,
    id: string,
    input: { verified: boolean; reference: string },
  ) {
    return this.persistence.reviewAccount(this.actor(actorId), id, input);
  }
  createRequest(
    userId: string | undefined,
    accountId: string,
    grossAmount: string,
    idempotencyKey: string,
  ) {
    return this.persistence.createRequest(
      this.actor(userId),
      accountId,
      grossAmount,
      idempotencyKey,
    );
  }
  cancelRequest(userId: string | undefined, id: string) {
    return this.persistence.cancelRequest(this.actor(userId), id);
  }
  createBatch(actorId: string | undefined, requestIds: readonly string[]) {
    return this.persistence.createBatch(this.actor(actorId), requestIds);
  }
  exportBatch(actorId: string | undefined, id: string) {
    return this.persistence.exportBatch(this.actor(actorId), id);
  }
  completeRequest(
    actorId: string | undefined,
    id: string,
    input: { providerTxnId: string; evidenceReference: string },
  ) {
    return this.persistence.completeRequest(this.actor(actorId), id, input);
  }
  failRequest(
    actorId: string | undefined,
    id: string,
    input: { reason: string; evidenceReference: string },
  ) {
    return this.persistence.failRequest(this.actor(actorId), id, input);
  }
}
