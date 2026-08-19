import { IsString, Length, Matches, MaxLength } from 'class-validator';

import { IsStrongPassword, Trim } from '@/common/decorators';

import { PasswordPolicy } from '../../../domain';

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
  @MaxLength(PasswordPolicy.MAX_LENGTH, {
    message: `Mật khẩu không được vượt quá ${PasswordPolicy.MAX_LENGTH} ký tự`,
  })
  @IsStrongPassword(
    {
      minLength: PasswordPolicy.MIN_LENGTH,
      maxLength: PasswordPolicy.MAX_LENGTH,
      requireLowercase: PasswordPolicy.REQUIRE_LOWERCASE,
      requireUppercase: PasswordPolicy.REQUIRE_UPPERCASE,
      requireNumber: PasswordPolicy.REQUIRE_NUMBER,
      requireSymbol: PasswordPolicy.REQUIRE_SYMBOL,
    },
    {
      message: `Mật khẩu phải có từ ${PasswordPolicy.MIN_LENGTH} đến ${PasswordPolicy.MAX_LENGTH} ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt`,
    },
  )
  newPassword!: string;
}
