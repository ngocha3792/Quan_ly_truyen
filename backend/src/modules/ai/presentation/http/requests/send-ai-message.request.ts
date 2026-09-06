import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendAiMessageRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}
