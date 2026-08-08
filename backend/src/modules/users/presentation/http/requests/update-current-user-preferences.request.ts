import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCurrentUserPreferencesRequest {
  @IsOptional()
  @IsBoolean()
  newChapterNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  showRecentActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  allowUpdateEmails?: boolean;
}
