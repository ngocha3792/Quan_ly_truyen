import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type {
  PublicStoryListSort,
  PublicStoryListStatus,
} from '../../../application';

const PUBLIC_STORY_SORTS: readonly PublicStoryListSort[] = [
  'latest',
  'popular',
  'rating',
  'chapter-count',
  'oldest',
];

const PUBLIC_STORY_STATUSES: readonly PublicStoryListStatus[] = [
  'ongoing',
  'completed',
  'hiatus',
];

export class ListPublicStoriesRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  genre?: string;

  @IsOptional()
  @IsIn(PUBLIC_STORY_STATUSES)
  status?: PublicStoryListStatus;

  @IsOptional()
  @IsIn(PUBLIC_STORY_SORTS)
  sort: PublicStoryListSort = 'latest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  yearTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
