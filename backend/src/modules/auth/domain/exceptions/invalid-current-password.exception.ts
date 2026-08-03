import { AccessDeniedException } from '@/common/exceptions';

export class InvalidCurrentPasswordException extends AccessDeniedException {
  constructor() {
    super({
      code: 'AUTH_CURRENT_PASSWORD_INVALID',

      message: 'Mật khẩu hiện tại không chính xác',

      details: {
        field: 'currentPassword',
      },
    });
  }
}
