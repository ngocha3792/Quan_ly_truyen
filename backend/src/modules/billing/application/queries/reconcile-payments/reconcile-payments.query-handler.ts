import { Inject, Injectable } from '@nestjs/common';

import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  type PaymentReconciliationRecord,
} from '../../ports';

@Injectable()
export class ReconcilePaymentsQueryHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  execute(): Promise<PaymentReconciliationRecord> {
    return this.persistence.reconcile();
  }
}
