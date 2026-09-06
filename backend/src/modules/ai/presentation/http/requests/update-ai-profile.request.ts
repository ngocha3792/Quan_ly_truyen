import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

export class UpdateAiUserProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  systemPrompt?: string | null;

  @IsOptional()
  @IsString()
  @Matches(LANGUAGE_CODE_PATTERN)
  defaultTranslationLanguageCode?: string;

  @IsOptional()
  @IsBoolean()
  autoTranslateOnPublish?: boolean;
}

export class UpdateAiStoryProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  systemPrompt?: string | null;

  @IsOptional()
  @IsString()
  @Matches(LANGUAGE_CODE_PATTERN)
  defaultTranslationLanguageCode?: string | null;

  @IsOptional()
  @IsBoolean()
  autoTranslateOnPublish?: boolean | null;
}
