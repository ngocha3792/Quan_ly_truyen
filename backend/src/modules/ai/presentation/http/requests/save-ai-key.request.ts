import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveAiKeyRequest {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey!: string;
}
