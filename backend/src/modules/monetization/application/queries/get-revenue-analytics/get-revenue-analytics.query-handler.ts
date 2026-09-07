import { Inject, Injectable } from '@nestjs/common';

import type { RevenueAnalyticsResultDto } from '../../dto';
import { toRevenueAnalyticsResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { GetRevenueAnalyticsQuery } from './get-revenue-analytics.query';

@Injectable()
export class GetRevenueAnalyticsQueryHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    query: GetRevenueAnalyticsQuery,
  ): Promise<RevenueAnalyticsResultDto> {
    return toRevenueAnalyticsResult(
      await this.persistence.getRevenueAnalytics({
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.to ? { to: new Date(query.to) } : {}),
        limit: query.limit,
      }),
    );
  }
}
