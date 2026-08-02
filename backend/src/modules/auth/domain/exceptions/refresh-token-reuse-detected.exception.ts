import { InvalidTokenException } from '@/common/exceptions';

export class RefreshTokenReuseDetectedException extends InvalidTokenException {
  constructor() {
    super({
      code: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
      message: 'Phiên đăng nhập không còn hiệu lực',
    });
  }
}
