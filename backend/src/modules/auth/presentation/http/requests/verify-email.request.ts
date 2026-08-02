import { IsString, Length, Matches } from 'class-validator';

import { Trim } from '@/common/decorators';

export class VerifyEmailRequest {
  @Trim()
  @IsString()
  @Length(32, 512, {
    message: 'Token xác minh email không hợp lệ',
  })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Token xác minh email không hợp lệ',
  })
  token!: string;
}
