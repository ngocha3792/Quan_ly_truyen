import type { ForgotPasswordResultDto } from '../dto';

export class ForgotPasswordResultMapper {
  static accepted(): ForgotPasswordResultDto {
    return {
      accepted: true,

      message:
        'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email',
    };
  }
}
