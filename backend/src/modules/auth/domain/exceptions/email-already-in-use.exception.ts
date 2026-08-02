import { ResourceAlreadyExistsException } from '@/common/exceptions';

export class EmailAlreadyInUseException extends ResourceAlreadyExistsException {
  constructor(email: string) {
    super({
      code: 'AUTH_EMAIL_ALREADY_IN_USE',
      message: 'Email đã được sử dụng',
      resource: 'Tài khoản',
      field: 'email',
      value: email,
    });
  }
}
