import { IsString, Length, Matches } from 'class-validator';

import { Trim } from '@/common/decorators';

export class OAuthFinalizeRequest {
  @Trim()
  @IsString()
  @Length(32, 512)
  @Matches(/^[A-Za-z0-9_-]+$/u, {
    message: 'OAuth handoff không hợp lệ',
  })
  handoff!: string;
}
