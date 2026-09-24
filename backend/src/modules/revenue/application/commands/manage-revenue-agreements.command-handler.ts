import { Inject, Injectable } from '@nestjs/common';
import {
  REVENUE_ALLOCATION_PORT,
  type CreateRevenueAgreementInput,
  type RevenueAllocationPort,
} from '../ports/revenue-allocation.port';

@Injectable()
export class ManageRevenueAgreementsCommandHandler {
  constructor(
    @Inject(REVENUE_ALLOCATION_PORT)
    private readonly persistence: RevenueAllocationPort,
  ) {}
  create(input: CreateRevenueAgreementInput) {
    return this.persistence.createAgreement(input);
  }
  list(storyId: string, userId?: string) {
    return this.persistence.listAgreements(storyId, userId);
  }
  settle(limit = 100) {
    return this.persistence.settlePending(limit);
  }
}
