import { IsString, Length, Matches } from 'class-validator';

import { Trim } from '@/common/decorators';

export class ConfirmEmailChangeRequest {
  @Trim()
  @IsString()
  @Length(32, 512, {
    message: 'Token xác nhận thay đổi email không hợp lệ',
  })
  @Matches(/^[A-Za-z0-9_-]+$/u, {
    message: 'Token xác nhận thay đổi email không hợp lệ',
  })
  token!: string;
}
