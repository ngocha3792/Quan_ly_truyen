import { createHash } from 'node:crypto';

import { isUuidV4 } from '@/common/utils';
import { AuthenticationRequiredException } from '@/common/exceptions';

import { InvalidBillingInputException } from '../exceptions';

export function assertCreatePaymentOrderInput(input: {
  userId: string;
  packageId: string;
  idempotencyKey: string;
}): void {
  if (!isUuidV4(input.userId)) {
    throw new InvalidBillingInputException('Tài khoản không hợp lệ', 'userId');
  }
  if (!isUuidV4(input.packageId)) {
    throw new InvalidBillingInputException(
      'Gói Credit không hợp lệ',
      'packageId',
    );
  }
  const keyLength = input.idempotencyKey.trim().length;
  if (keyLength < 8 || keyLength > 200) {
    throw new InvalidBillingInputException(
      'Idempotency key phải có độ dài từ 8 đến 200 ký tự',
      'idempotencyKey',
    );
  }
}

export function buildPaymentOrderRequestHash(
  userId: string,
  packageId: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify([userId, packageId, 'CREDIT_TOP_UP']))
    .digest('hex');
}

export function requireBillingUserId(userId: string | undefined): string {
  if (!userId) {
    throw new AuthenticationRequiredException({
      message: 'Bạn cần đăng nhập để tạo hoặc xem đơn nạp Credit',
    });
  }
  return userId;
}
