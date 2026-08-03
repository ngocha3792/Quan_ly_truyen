import { AccessDeniedException } from '@/common/exceptions';

export class PasswordChangeUnavailableException extends AccessDeniedException {
  constructor() {
    super({
      code: 'AUTH_PASSWORD_CHANGE_UNAVAILABLE',

      message: 'Tài khoản hiện tại chưa hỗ trợ đổi mật khẩu bằng mật khẩu cũ',
    });
  }
}
