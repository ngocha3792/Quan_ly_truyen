import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAiConversationRequest {
  @IsUUID('4')
  connectionId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  modelId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
}
