import { IsString, MaxLength, MinLength } from 'class-validator';

import { AI_MAX_INPUT_CHARACTERS } from '../../../application/constants/ai-generation.constants';

export class SendAiMessageRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(AI_MAX_INPUT_CHARACTERS)
  content!: string;
}
