import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAiConnectionRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  baseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultModel?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
