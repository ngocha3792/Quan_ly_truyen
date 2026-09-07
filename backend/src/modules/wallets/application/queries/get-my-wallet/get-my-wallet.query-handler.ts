import { Inject, Injectable } from '@nestjs/common';

import { requireWalletUserId } from '../../../domain';
import type { WalletBalanceResultDto } from '../../dto';
import { toWalletBalanceResult } from '../../mappers';
import {
  WALLET_PERSISTENCE_PORT,
  type WalletPersistencePort,
} from '../../ports';
import { GetMyWalletQuery } from './get-my-wallet.query';

@Injectable()
export class GetMyWalletQueryHandler {
  constructor(
    @Inject(WALLET_PERSISTENCE_PORT)
    private readonly persistence: WalletPersistencePort,
  ) {}

  async execute(query: GetMyWalletQuery): Promise<WalletBalanceResultDto> {
    const record = await this.persistence.findBalance(
      requireWalletUserId(query.userId),
      'CREDIT',
    );
    return toWalletBalanceResult(record);
  }
}
