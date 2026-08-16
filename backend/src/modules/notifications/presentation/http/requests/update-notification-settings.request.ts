import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsRequest {
  @IsOptional()
  @IsBoolean()
  readonly newChapters?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly comments?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly system?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly promotions?: boolean;
}
