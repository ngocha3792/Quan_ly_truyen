import { IsEmail, IsString, Length } from 'class-validator';

import { NormalizeEmail } from '@/common/decorators';

export class ForgotPasswordRequest {
  @NormalizeEmail()
  @IsString()
  @IsEmail(
    {},
    {
      message: 'Email không hợp lệ',
    },
  )
  @Length(3, 320, {
    message: 'Email phải có độ dài từ 3 đến 320 ký tự',
  })
  email!: string;
}
