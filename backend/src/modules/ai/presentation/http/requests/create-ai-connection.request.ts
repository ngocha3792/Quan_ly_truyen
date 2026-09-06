import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AiProvider } from '@/generated/prisma/client';

export class CreateAiConnectionRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(AiProvider)
  provider!: AiProvider;

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  baseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultModel?: string | null;
}
