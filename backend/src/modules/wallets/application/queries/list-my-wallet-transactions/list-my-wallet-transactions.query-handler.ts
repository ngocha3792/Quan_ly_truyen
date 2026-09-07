import { Inject, Injectable } from '@nestjs/common';

import { requireWalletUserId } from '../../../domain';
import type { WalletTransactionPageResultDto } from '../../dto';
import { toWalletTransactionPageResult } from '../../mappers';
import {
  WALLET_PERSISTENCE_PORT,
  type WalletPersistencePort,
} from '../../ports';
import { ListMyWalletTransactionsQuery } from './list-my-wallet-transactions.query';

@Injectable()
export class ListMyWalletTransactionsQueryHandler {
  constructor(
    @Inject(WALLET_PERSISTENCE_PORT)
    private readonly persistence: WalletPersistencePort,
  ) {}

  async execute(
    query: ListMyWalletTransactionsQuery,
  ): Promise<WalletTransactionPageResultDto> {
    const record = await this.persistence.listTransactions({
      userId: requireWalletUserId(query.userId),
      currency: 'CREDIT',
      page: query.page,
      pageSize: query.pageSize,
    });
    return toWalletTransactionPageResult(record);
  }
}
