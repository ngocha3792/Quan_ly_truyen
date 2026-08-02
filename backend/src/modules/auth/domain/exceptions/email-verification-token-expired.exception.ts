import { ResourceGoneException } from '@/common/exceptions';

export class EmailVerificationTokenExpiredException extends ResourceGoneException {
  constructor(expiresAt?: Date) {
    super({
      code: 'AUTH_EMAIL_VERIFICATION_TOKEN_EXPIRED',
      message: 'Liên kết xác minh email đã hết hạn',
      resource: 'Liên kết xác minh email',
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
