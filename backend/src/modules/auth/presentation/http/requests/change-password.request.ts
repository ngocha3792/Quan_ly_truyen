import { IsString, IsStrongPassword, Length, MaxLength } from 'class-validator';

export class ChangePasswordRequest {
  /*
   * Không dùng @Trim() cho password.
   */
  @IsString()
  @Length(1, 72, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  currentPassword!: string;

  @IsString()
  @MaxLength(72, {
    message: 'Mật khẩu mới không được vượt quá 72 ký tự',
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
        'Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
    },
  )
  newPassword!: string;
}
