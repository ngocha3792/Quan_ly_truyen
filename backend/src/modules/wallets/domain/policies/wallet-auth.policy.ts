import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

export function requireWalletUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'WALLET_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập để xem ví',
    });
  }

  return userId;
}
