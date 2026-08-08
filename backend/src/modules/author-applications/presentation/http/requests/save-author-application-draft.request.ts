import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveAuthorApplicationDraftRequest {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  penName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  fullName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  portfolioUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  primaryGenre?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  experience?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  introduction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  firstWorkSynopsis?: string | null;

  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;
}
