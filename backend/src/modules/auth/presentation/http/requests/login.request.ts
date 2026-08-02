import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { Trim } from '@/common/decorators';

export class LoginRequest {
  @Trim()
  @IsString()
  @Length(3, 320, {
    message: 'Email hoặc tên đăng nhập không hợp lệ',
  })
  identifier!: string;

  @IsString()
  @Length(1, 256, {
    message: 'Mật khẩu không được để trống',
  })
  password!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}
