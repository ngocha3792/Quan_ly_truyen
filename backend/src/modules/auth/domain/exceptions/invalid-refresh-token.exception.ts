import { InvalidTokenException } from '@/common/exceptions';

export class InvalidRefreshTokenException extends InvalidTokenException {
  constructor(cause?: unknown) {
    super({
      code: 'AUTH_INVALID_REFRESH_TOKEN',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      cause,
    });
  }
}
