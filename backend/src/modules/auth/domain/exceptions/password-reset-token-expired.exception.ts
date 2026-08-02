import { ResourceGoneException } from '@/common/exceptions';

export class PasswordResetTokenExpiredException extends ResourceGoneException {
  constructor(expiresAt?: Date) {
    super({
      code: 'AUTH_PASSWORD_RESET_TOKEN_EXPIRED',

      message: 'Liên kết đặt lại mật khẩu đã hết hạn',

      resource: 'Liên kết đặt lại mật khẩu',

      details: {
        ...(expiresAt
          ? {
              expiresAt: expiresAt.toISOString(),
            }
          : {}),
      },
    });
  }
}
