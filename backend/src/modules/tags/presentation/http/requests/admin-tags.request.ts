import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizeTagName } from '../../../domain';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/common/constants';

export class ListAdminTagsRequest {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  q?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = DEFAULT_PAGE;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  pageSize = DEFAULT_PAGE_LIMIT;
  @IsOptional()
  @IsIn(['name:asc', 'name:desc', 'createdAt:asc', 'createdAt:desc'])
  sort = 'name:asc';
}

export class CreateTagRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeTagName(value) : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class UpdateTagRequest extends CreateTagRequest {}

export class MergeTagRequest {
  @IsUUID('4')
  targetTagId!: string;
}
