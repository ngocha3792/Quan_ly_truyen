import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  InvalidWalletTransactionException,
  MAX_WALLET_CREDIT_AMOUNT,
} from '../../../domain';
import type { WalletMutationResultDto } from '../../dto';
import {
  PostWalletTransactionCommand,
  PostWalletTransactionCommandHandler,
} from '../post-wallet-transaction';
import { AdminAdjustWalletCommand } from './admin-adjust-wallet.command';

@Injectable()
export class AdminAdjustWalletCommandHandler {
  constructor(
    private readonly postTransaction: PostWalletTransactionCommandHandler,
  ) {}

  execute(command: AdminAdjustWalletCommand): Promise<WalletMutationResultDto> {
    if (!command.actorId) {
      throw new AuthenticationRequiredException();
    }
    if (!isUuidV4(command.actorId) || !isUuidV4(command.userId)) {
      throw new InvalidWalletTransactionException('Tài khoản không hợp lệ');
    }
    const reason = command.reason.trim();
    if (reason.length < 10 || reason.length > 500) {
      throw new InvalidWalletTransactionException(
        'Lý do điều chỉnh phải có độ dài từ 10 đến 500 ký tự',
      );
    }
    if (!/^[1-9]\d{0,15}$/u.test(command.amount)) {
      throw new InvalidWalletTransactionException(
        'Số Credit điều chỉnh không hợp lệ',
      );
    }
    const amount = BigInt(command.amount);
    if (amount > MAX_WALLET_CREDIT_AMOUNT) {
      throw new InvalidWalletTransactionException('Số Credit vượt giới hạn ví');
    }
    const sourceKey = command.idempotencyKey?.trim() ?? '';
    if (sourceKey.length < 8 || sourceKey.length > 200) {
      throw new InvalidWalletTransactionException(
        'Idempotency key phải có độ dài từ 8 đến 200 ký tự',
      );
    }
    const keyHash = createHash('sha256').update(sourceKey).digest('hex');
    return this.postTransaction.execute(
      new PostWalletTransactionCommand(
        command.userId,
        'CREDIT',
        'ADMIN_ADJUSTMENT',
        command.direction,
        amount,
        'ADJUSTMENT',
        `admin-adjustment:${keyHash}`,
        'admin_adjustment',
        keyHash,
        { actorId: command.actorId, reason },
        {
          actorId: command.actorId,
          reason,
          ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
          ...(command.userAgent ? { userAgent: command.userAgent } : {}),
          ...(command.requestId ? { requestId: command.requestId } : {}),
        },
      ),
    );
  }
}
