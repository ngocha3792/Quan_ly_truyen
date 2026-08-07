import { IsString, Length, Matches } from 'class-validator';

import { Trim } from '@/common/decorators';

export class ValidatePasswordResetTokenRequest {
  @Trim()
  @IsString()
  @Length(32, 512, {
    message: 'Token đặt lại mật khẩu không hợp lệ',
  })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Token đặt lại mật khẩu không hợp lệ',
  })
  token!: string;
}
