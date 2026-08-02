import { AccessDeniedException } from '@/common/exceptions';

export class EmailNotVerifiedException extends AccessDeniedException {
  constructor() {
    super({
      code: 'AUTH_EMAIL_NOT_VERIFIED',
      message: 'Bạn cần xác minh địa chỉ email trước khi đăng nhập',
    });
  }
}
