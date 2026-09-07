import { Inject, Injectable } from '@nestjs/common';

import { assertWalletUserId } from '../../../domain';
import type { WalletReconciliationResultDto } from '../../dto';
import { toWalletReconciliationResult } from '../../mappers';
import {
  WALLET_PERSISTENCE_PORT,
  type WalletPersistencePort,
} from '../../ports';
import { ReconcileWalletQuery } from './reconcile-wallet.query';

@Injectable()
export class ReconcileWalletQueryHandler {
  constructor(
    @Inject(WALLET_PERSISTENCE_PORT)
    private readonly persistence: WalletPersistencePort,
  ) {}

  async execute(
    query: ReconcileWalletQuery,
  ): Promise<WalletReconciliationResultDto> {
    assertWalletUserId(query.userId);
    const record = await this.persistence.reconcile(
      query.userId,
      query.currency,
    );
    return toWalletReconciliationResult(record);
  }
}
