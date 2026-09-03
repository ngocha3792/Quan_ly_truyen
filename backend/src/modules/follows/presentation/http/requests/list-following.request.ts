import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/common/constants';

export class ListFollowingRequest {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = DEFAULT_PAGE;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  pageSize = DEFAULT_PAGE_LIMIT;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value))
      return value
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim())
        .filter(Boolean);
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsUUID('4', { each: true })
  authorIds?: string[];
}
