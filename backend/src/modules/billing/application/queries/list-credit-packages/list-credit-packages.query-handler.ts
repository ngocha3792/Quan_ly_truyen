import { Inject, Injectable } from '@nestjs/common';

import type { CreditPackageResultDto } from '../../dto';
import { toCreditPackageResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
} from '../../ports';
import { ListCreditPackagesQuery } from './list-credit-packages.query';

@Injectable()
export class ListCreditPackagesQueryHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(
    query: ListCreditPackagesQuery,
  ): Promise<readonly CreditPackageResultDto[]> {
    return (await this.persistence.listPackages(query.activeOnly)).map(
      toCreditPackageResult,
    );
  }
}
