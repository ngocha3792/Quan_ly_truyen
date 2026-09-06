import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AiProvider } from '@/generated/prisma/client';

export class CreateAiConversationRequest {
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
}
