import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { StoryDraftPolicy } from '../../../domain';
import { STORY_FORMAT_VALUES } from './create-author-story.request';

export class UpdateAuthorStoryRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(StoryDraftPolicy.TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  synopsis?: string | null;

  @IsOptional()
  @IsIn(STORY_FORMAT_VALUES)
  format?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsUUID('4')
  coverMediaId?: string | null;
}
