import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

import { Trim } from '@/common/decorators';

export class RequestRecoveryEmailRequest {
  @Trim()
  @IsString()
  @IsEmail(
    {},
    {
      message: 'Email khôi phục không hợp lệ',
    },
  )
  @MaxLength(320, {
    message: 'Email khôi phục không được vượt quá 320 ký tự',
  })
  email!: string;

  /*
   * Không Trim password.
   */
  @IsString()
  @Length(1, 72, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  currentPassword!: string;
}

export class VerifyRecoveryEmailRequest {
  @Trim()
  @IsString()
  @Matches(/^\d{6}$/u, {
    message: 'Mã xác minh phải gồm 6 chữ số',
  })
  code!: string;
}

export class RemoveRecoveryEmailRequest {
  /*
   * Không Trim password.
   */
  @IsString()
  @Length(1, 72, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  currentPassword!: string;
}
