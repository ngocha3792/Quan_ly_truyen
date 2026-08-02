import { ResourceAlreadyExistsException } from '@/common/exceptions';

export class UsernameAlreadyInUseException extends ResourceAlreadyExistsException {
  constructor(username: string) {
    super({
      code: 'AUTH_USERNAME_ALREADY_IN_USE',
      message: 'Tên đăng nhập đã được sử dụng',
      resource: 'Tài khoản',
      field: 'username',
      value: username,
    });
  }
}
