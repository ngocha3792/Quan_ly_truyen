import { IsEmail, IsString, Length, Matches } from 'class-validator';

import {
  IsStrongPassword,
  NormalizeEmail,
  Trim,
} from '@/common/decorators/validation';
import { PasswordPolicy } from '../../../domain';

export class RegisterRequest {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Length(3, 320, {
    message: 'Email phải có độ dài từ 3 đến 320 ký tự',
  })
  email!: string;

  @Trim()
  @IsString()
  @Length(3, 50, {
    message: 'Tên đăng nhập phải có độ dài từ 3 đến 50 ký tự',
  })
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Tên đăng nhập chỉ được chứa chữ cái, chữ số và dấu gạch dưới',
  })
  username!: string;

  @IsString()
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
  password!: string;

  @Trim()
  @IsString()
  @Length(1, 120, {
    message: 'Tên hiển thị phải có độ dài từ 1 đến 120 ký tự',
  })
  displayName!: string;
}
