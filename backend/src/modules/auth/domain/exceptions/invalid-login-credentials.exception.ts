import { InvalidCredentialsException } from '@/common/exceptions';

export class InvalidLoginCredentialsException extends InvalidCredentialsException {
  constructor() {
    super('Email, tên đăng nhập hoặc mật khẩu không chính xác');
  }
}
