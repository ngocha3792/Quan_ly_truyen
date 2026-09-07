import { Inject, Injectable } from '@nestjs/common';

import { requireBillingUserId } from '../../../domain';
import type { PaymentOrderResultDto } from '../../dto';
import { toPaymentOrderResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
} from '../../ports';
import { GetOwnPaymentOrderQuery } from './get-own-payment-order.query';

@Injectable()
export class GetOwnPaymentOrderQueryHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(
    query: GetOwnPaymentOrderQuery,
  ): Promise<PaymentOrderResultDto> {
    return toPaymentOrderResult(
      await this.persistence.getOwnOrder(
        requireBillingUserId(query.userId),
        query.orderId,
      ),
    );
  }
}
