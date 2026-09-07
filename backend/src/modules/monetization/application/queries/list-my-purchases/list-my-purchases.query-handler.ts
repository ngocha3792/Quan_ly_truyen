import { Inject, Injectable } from '@nestjs/common';

import { requireMonetizationUserId } from '../../../domain';
import type { ChapterPurchasePageResultDto } from '../../dto';
import { toChapterPurchasePageResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { ListMyPurchasesQuery } from './list-my-purchases.query';

@Injectable()
export class ListMyPurchasesQueryHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    query: ListMyPurchasesQuery,
  ): Promise<ChapterPurchasePageResultDto> {
    const userId = requireMonetizationUserId(query.userId);
    return toChapterPurchasePageResult(
      await this.persistence.listPurchases({
        userId,
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  }
}
