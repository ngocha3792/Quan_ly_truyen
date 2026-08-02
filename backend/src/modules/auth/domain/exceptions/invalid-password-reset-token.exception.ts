import { InvalidTokenException } from '@/common/exceptions';

export class InvalidPasswordResetTokenException extends InvalidTokenException {
  constructor(cause?: unknown) {
    super({
      code: 'AUTH_PASSWORD_RESET_TOKEN_INVALID',

      message: 'Liên kết đặt lại mật khẩu không hợp lệ',

      cause,
    });
  }
}
