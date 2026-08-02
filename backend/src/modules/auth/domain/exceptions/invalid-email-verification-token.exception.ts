import { InvalidTokenException } from '@/common/exceptions';

export class InvalidEmailVerificationTokenException extends InvalidTokenException {
  constructor(cause?: unknown) {
    super({
      code: 'AUTH_EMAIL_VERIFICATION_TOKEN_INVALID',
      message: 'Liên kết xác minh email không hợp lệ',
      cause,
    });
  }
}
