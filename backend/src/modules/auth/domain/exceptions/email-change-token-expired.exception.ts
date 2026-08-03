import { ResourceGoneException } from '@/common/exceptions';

export class EmailChangeTokenExpiredException extends ResourceGoneException {
  constructor(expiresAt?: Date) {
    super({
      code: 'AUTH_EMAIL_CHANGE_TOKEN_EXPIRED',

      message: 'Liên kết xác nhận thay đổi email đã hết hạn',

      resource: 'Liên kết xác nhận thay đổi email',

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
