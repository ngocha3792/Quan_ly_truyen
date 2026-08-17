import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ChapterDraftPolicy } from '../../../domain';

export class UpdateAuthorChapterRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(ChapterDraftPolicy.TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string | null;
}
