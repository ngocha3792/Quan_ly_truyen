import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

import { Trim } from '@/common/decorators';

export class RequestEmailChangeRequest {
  /*
   * Không trim password.
   */
  @IsString()
  @Length(1, 72, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  currentPassword!: string;

  @Trim()
  @IsString()
  @IsEmail(
    {},
    {
      message: 'Email mới không hợp lệ',
    },
  )
  @MaxLength(320, {
    message: 'Email mới không được vượt quá 320 ký tự',
  })
  newEmail!: string;
}
