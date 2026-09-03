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
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/common/constants';

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
  page: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  pageSize: number = DEFAULT_PAGE_LIMIT;
}
