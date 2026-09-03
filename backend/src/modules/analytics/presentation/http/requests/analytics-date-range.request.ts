import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/common/constants';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class AnalyticsDateRangeRequest {
  @IsOptional() @Matches(DATE_PATTERN) from?: string;
  @IsOptional() @Matches(DATE_PATTERN) to?: string;
}

export class AnalyticsStoriesRequest extends AnalyticsDateRangeRequest {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = DEFAULT_PAGE;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  pageSize = DEFAULT_PAGE_LIMIT;
}
