import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { assertWalletMutationInput } from '../../../domain';
import type { WalletMutationResultDto } from '../../dto';
import { toWalletMutationResult } from '../../mappers';
import {
  WALLET_PERSISTENCE_PORT,
  type WalletPersistencePort,
} from '../../ports';
import { PostWalletTransactionCommand } from './post-wallet-transaction.command';

@Injectable()
export class PostWalletTransactionCommandHandler {
  constructor(
    @Inject(WALLET_PERSISTENCE_PORT)
    private readonly persistence: WalletPersistencePort,
  ) {}

  async execute(
    command: PostWalletTransactionCommand,
  ): Promise<WalletMutationResultDto> {
    const idempotencyKey = command.idempotencyKey.trim();
    const referenceType = command.referenceType.trim();
    const referenceId = command.referenceId.trim();
    const requestHash = buildRequestHash({
      userId: command.userId,
      currency: command.currency,
      type: command.type,
      direction: command.direction,
      amount: command.amount,
      systemAccount: command.systemAccount,
      referenceType,
      referenceId,
    });

    assertWalletMutationInput({
      userId: command.userId,
      amount: command.amount,
      idempotencyKey,
      requestHash,
      referenceType,
      referenceId,
    });

    const walletAmount =
      command.direction === 'CREDIT' ? command.amount : -command.amount;
    const result = await this.persistence.postTransaction({
      userId: command.userId,
      currency: command.currency,
      type: command.type,
      walletAmount,
      systemAccount: command.systemAccount,
      idempotencyKey,
      requestHash,
      referenceType,
      referenceId,
      ...(command.metadata ? { metadata: command.metadata } : {}),
      ...(command.audit ? { audit: command.audit } : {}),
    });

    return toWalletMutationResult(result);
  }
}

function buildRequestHash(input: {
  userId: string;
  currency: string;
  type: string;
  direction: string;
  amount: bigint;
  systemAccount: string;
  referenceType: string;
  referenceId: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.userId,
        input.currency,
        input.type,
        input.direction,
        input.amount.toString(),
        input.systemAccount,
        input.referenceType,
        input.referenceId,
      ]),
    )
    .digest('hex');
}
