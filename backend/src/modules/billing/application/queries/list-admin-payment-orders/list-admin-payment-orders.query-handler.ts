import { Inject, Injectable } from '@nestjs/common';

import type { AdminPaymentOrderPageResultDto } from '../../dto';
import { toAdminPaymentOrderPageResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
} from '../../ports';
import { ListAdminPaymentOrdersQuery } from './list-admin-payment-orders.query';

@Injectable()
export class ListAdminPaymentOrdersQueryHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(
    query: ListAdminPaymentOrdersQuery,
  ): Promise<AdminPaymentOrderPageResultDto> {
    return toAdminPaymentOrderPageResult(
      await this.persistence.listAdminOrders({
        page: query.page,
        pageSize: query.pageSize,
        ...(query.status ? { status: query.status } : {}),
        ...(query.provider?.trim() ? { provider: query.provider.trim() } : {}),
        ...(query.search?.trim() ? { query: query.search.trim() } : {}),
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.to ? { to: new Date(query.to) } : {}),
      }),
    );
  }
}
