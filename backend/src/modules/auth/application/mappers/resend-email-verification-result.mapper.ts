import type { ResendEmailVerificationResultDto } from '../dto';

export class ResendEmailVerificationResultMapper {
  static accepted(): ResendEmailVerificationResultDto {
    return {
      accepted: true,

      /*
       * Response cố ý không tiết lộ:
       * - email có tồn tại hay không;
       * - email đã được xác minh hay chưa;
       * - request có đang bị cooldown hay không.
       */
      message:
        'Nếu tài khoản tồn tại và chưa được xác minh, email xác minh mới sẽ được gửi',
    };
  }
}
