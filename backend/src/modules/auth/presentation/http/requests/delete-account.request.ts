import { Equals, IsString, Length } from 'class-validator';

import { Trim } from '@/common/decorators';

export class DeleteAccountRequest {
  /*
   * Không trim password.
   * Khoảng trắng có thể là một phần
   * của mật khẩu hợp lệ.
   */
  @IsString()
  @Length(1, 72, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  password!: string;

  @Trim()
  @IsString()
  @Equals('XOA TAI KHOAN', {
    message: 'Nội dung xác nhận xóa tài khoản không chính xác',
  })
  confirmation!: string;
}
