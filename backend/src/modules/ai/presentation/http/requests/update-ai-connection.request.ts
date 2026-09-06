import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AiAuthType, AiProtocol } from '../../../domain/enums';

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

  @IsOptional()
  @IsEnum(AiAuthType)
  authType?: AiAuthType;

  @IsOptional()
  @IsEnum(AiProtocol)
  protocol?: AiProtocol;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  authHeaderName?: string | null;
}
