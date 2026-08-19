import { IsString, Length, MaxLength } from 'class-validator';

import { IsStrongPassword } from '@/common/decorators';

import { PasswordPolicy } from '../../../domain';

export class ChangePasswordRequest {
  /*
   * Không dùng @Trim() cho password.
   */
  @IsString()
  @Length(1, PasswordPolicy.MAX_LENGTH, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  currentPassword!: string;

  @IsString()
  @MaxLength(PasswordPolicy.MAX_LENGTH, {
    message: `Mật khẩu mới không được vượt quá ${PasswordPolicy.MAX_LENGTH} ký tự`,
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
      message: `Mật khẩu mới phải có từ ${PasswordPolicy.MIN_LENGTH} đến ${PasswordPolicy.MAX_LENGTH} ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt`,
    },
  )
  newPassword!: string;
}
