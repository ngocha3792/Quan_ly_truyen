import { InvalidTokenException } from '@/common/exceptions';

export class InvalidEmailChangeTokenException extends InvalidTokenException {
  constructor(cause?: unknown) {
    super({
      code: 'AUTH_EMAIL_CHANGE_TOKEN_INVALID',

      message: 'Liên kết xác nhận thay đổi email không hợp lệ',

      cause,
    });
  }
}
