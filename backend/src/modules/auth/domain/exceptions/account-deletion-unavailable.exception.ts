import { AccessDeniedException } from '@/common/exceptions';

export class AccountDeletionUnavailableException extends AccessDeniedException {
  constructor() {
    super({
      code: 'AUTH_ACCOUNT_DELETION_UNAVAILABLE',

      message: 'Tài khoản hiện tại chưa hỗ trợ xác nhận xóa bằng mật khẩu',
    });
  }
}
