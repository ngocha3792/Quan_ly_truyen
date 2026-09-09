import { Transform, Type } from 'class-transformer';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '@/common/constants';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  SearchInput,
  SearchKind,
  SearchSort,
} from '../../../domain/search.models';

export class SearchRequest implements SearchInput {
  @IsString() @MaxLength(200) q = '';
  @IsIn(['story', 'chapter']) kind: SearchKind = 'story';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) page = DEFAULT_PAGE;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) pageSize = DEFAULT_PAGE_LIMIT;
  @IsIn(['relevance', 'newest', 'views', 'followers', 'rating'])
  sort: SearchSort = 'relevance';
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(100) tag?: string;
  @IsOptional()
  @IsIn(['published', 'hiatus', 'completed'])
  status?: SearchInput['status'];
  @IsOptional()
  @IsIn(['everyone', 'teen', 'mature'])
  contentRating?: SearchInput['contentRating'];
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  yearFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999) yearTo?: number;
  @IsOptional() @IsUUID('4') storyId?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  featured?: boolean;
}
