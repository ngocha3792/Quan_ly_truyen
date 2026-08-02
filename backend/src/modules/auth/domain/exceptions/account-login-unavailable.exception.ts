import { AccessDeniedException } from '@/common/exceptions';

export class AccountLoginUnavailableException extends AccessDeniedException {
  constructor() {
    super({
      code: 'AUTH_ACCOUNT_LOGIN_UNAVAILABLE',
      message: 'Tài khoản hiện không thể đăng nhập',
    });
  }
}
