import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

import { Trim } from '@/common/decorators';

export class UpdateCurrentUserProfileRequest {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120, {
    message: 'Tên hiển thị phải có độ dài từ 1 đến 120 ký tự',
  })
  displayName?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000, {
    message: 'Tiểu sử không được vượt quá 1000 ký tự',
  })
  bio?: string | null;

  @IsOptional()
  @IsUUID('4', {
    message: 'avatarMediaId không hợp lệ',
  })
  avatarMediaId?: string | null;
}
