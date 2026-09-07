import { isUuidV4 } from '@/common/utils';

import { InvalidWalletTransactionException } from '../exceptions';
import { MAX_WALLET_CREDIT_AMOUNT } from '../enums';

const SHA_256_PATTERN = /^[0-9a-f]{64}$/u;

export function assertWalletMutationInput(input: {
  userId: string;
  amount: bigint;
  idempotencyKey: string;
  requestHash: string;
  referenceType: string;
  referenceId: string;
}): void {
  assertWalletUserId(input.userId);

  if (input.amount <= 0n) {
    throw new InvalidWalletTransactionException(
      'Số Credit giao dịch phải lớn hơn 0',
      'amount',
    );
  }

  if (input.amount > MAX_WALLET_CREDIT_AMOUNT) {
    throw new InvalidWalletTransactionException(
      `Số Credit giao dịch không được vượt quá ${MAX_WALLET_CREDIT_AMOUNT.toString()}`,
      'amount',
    );
  }

  assertBoundedText(input.idempotencyKey, 'idempotencyKey', 8, 200);
  assertBoundedText(input.referenceType, 'referenceType', 1, 100);
  assertBoundedText(input.referenceId, 'referenceId', 1, 100);

  if (!SHA_256_PATTERN.test(input.requestHash)) {
    throw new InvalidWalletTransactionException(
      'Request hash của giao dịch không hợp lệ',
      'requestHash',
    );
  }
}

export function assertWalletUserId(userId: string): void {
  if (!isUuidV4(userId)) {
    throw new InvalidWalletTransactionException(
      'Chủ sở hữu ví không hợp lệ',
      'userId',
    );
  }
}

function assertBoundedText(
  value: string,
  field: string,
  min: number,
  max: number,
): void {
  const length = value.trim().length;
  if (length < min || length > max) {
    throw new InvalidWalletTransactionException(
      `${field} phải có độ dài từ ${min} đến ${max} ký tự`,
      field,
    );
  }
}
