import { Inject, Injectable } from '@nestjs/common';

import type { AdminChapterPurchasePageResultDto } from '../../dto';
import { toAdminChapterPurchasePageResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { ListAdminPurchasesQuery } from './list-admin-purchases.query';

@Injectable()
export class ListAdminPurchasesQueryHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    query: ListAdminPurchasesQuery,
  ): Promise<AdminChapterPurchasePageResultDto> {
    return toAdminChapterPurchasePageResult(
      await this.persistence.listAdminPurchases({
        page: query.page,
        pageSize: query.pageSize,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search?.trim() ? { query: query.search.trim() } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.storyId ? { storyId: query.storyId } : {}),
        ...(query.authorId ? { authorId: query.authorId } : {}),
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.to ? { to: new Date(query.to) } : {}),
      }),
    );
  }
}
