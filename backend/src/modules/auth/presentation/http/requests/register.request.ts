import { IsEmail, IsString, Length, Matches } from 'class-validator';

import {
  IsStrongPassword,
  NormalizeEmail,
  Trim,
} from '@/common/decorators/validation';

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
    {},
    {
      message:
        'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
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
