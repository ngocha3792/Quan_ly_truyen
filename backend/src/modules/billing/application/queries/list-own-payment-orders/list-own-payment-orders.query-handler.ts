import { Inject, Injectable } from '@nestjs/common';

import { requireBillingUserId } from '../../../domain';
import type { PaymentOrderPageResultDto } from '../../dto';
import { toPaymentOrderPageResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
} from '../../ports';
import { ListOwnPaymentOrdersQuery } from './list-own-payment-orders.query';

@Injectable()
export class ListOwnPaymentOrdersQueryHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(
    query: ListOwnPaymentOrdersQuery,
  ): Promise<PaymentOrderPageResultDto> {
    return toPaymentOrderPageResult(
      await this.persistence.listOwnOrders({
        userId: requireBillingUserId(query.userId),
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  }
}
