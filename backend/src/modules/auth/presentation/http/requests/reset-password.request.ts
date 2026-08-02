import {
  IsString,
  IsStrongPassword,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { Trim } from '@/common/decorators';

export class ResetPasswordRequest {
  @Trim()
  @IsString()
  @Length(32, 512, {
    message: 'Token đặt lại mật khẩu không hợp lệ',
  })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Token đặt lại mật khẩu không hợp lệ',
  })
  token!: string;

  @IsString()
  @MaxLength(72, {
    message: 'Mật khẩu không được vượt quá 72 ký tự',
  })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
    },
  )
  newPassword!: string;
}
