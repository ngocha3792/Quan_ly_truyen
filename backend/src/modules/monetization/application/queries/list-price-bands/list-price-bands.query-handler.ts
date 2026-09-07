import { Inject, Injectable } from '@nestjs/common';

import type { PriceBandResultDto } from '../../dto';
import { toPriceBandResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { ListPriceBandsQuery } from './list-price-bands.query';

@Injectable()
export class ListPriceBandsQueryHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    query: ListPriceBandsQuery,
  ): Promise<readonly PriceBandResultDto[]> {
    return (await this.persistence.listPriceBands(query.activeOnly)).map(
      toPriceBandResult,
    );
  }
}
