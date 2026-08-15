import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { StoryDraftPolicy } from '../../../domain';

export class CreateAuthorStoryRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(StoryDraftPolicy.TITLE_MAX_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  synopsis?: string | null;
}
