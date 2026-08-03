import { InvalidInputException } from '@/common/exceptions';

export class NewPasswordMustDifferException extends InvalidInputException {
  constructor() {
    super({
      code: 'AUTH_NEW_PASSWORD_MUST_DIFFER',

      message: 'Mật khẩu mới phải khác mật khẩu hiện tại',

      details: {
        field: 'newPassword',
      },
    });
  }
}
