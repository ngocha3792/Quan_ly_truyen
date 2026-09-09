import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTtsConnectionRequest {
  @IsIn(['ELEVEN_LABS'])
  provider!: 'ELEVEN_LABS';

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  voiceId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  voiceName!: string;

  @IsString()
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/u)
  language!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  apiKey!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  stability?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  similarity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  style?: number;
}

export class GenerateTtsManifestRequest {
  @IsUUID('4')
  chapterId!: string;

  @IsUUID('4')
  connectionId!: string;

  @IsString()
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/u)
  language!: string;

  @IsOptional()
  @IsIn(['NONE', 'SYSTEM'])
  fallbackPolicy?: 'NONE' | 'SYSTEM';
}
