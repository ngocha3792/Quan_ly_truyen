import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  REVENUE_PAYOUT_PORT,
  RevenuePayoutPort,
} from '../ports/revenue-payout.persistence.port';

@Injectable()
export class RevenuePayoutQueryHandler {
  constructor(
    @Inject(REVENUE_PAYOUT_PORT)
    private readonly persistence: RevenuePayoutPort,
  ) {}
  policy() {
    return this.persistence.getPolicy();
  }
  earnings(userId?: string) {
    if (!userId) throw new UnauthorizedException();
    return this.persistence.getEarnings(userId);
  }
  accounts(userId?: string) {
    return this.persistence.listAccounts(userId);
  }
  requests(userId?: string) {
    return this.persistence.listRequests(userId);
  }
  batches() {
    return this.persistence.listBatches();
  }
  reconcile() {
    return this.persistence.reconcile();
  }
}
