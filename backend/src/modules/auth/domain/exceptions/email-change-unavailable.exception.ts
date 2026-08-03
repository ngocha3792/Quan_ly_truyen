import { AccessDeniedException } from '@/common/exceptions';

export class EmailChangeUnavailableException extends AccessDeniedException {
  constructor() {
    super({
      code: 'AUTH_EMAIL_CHANGE_UNAVAILABLE',

      message:
        'Tài khoản hiện tại không thể xác nhận thay đổi email bằng mật khẩu',
    });
  }
}
