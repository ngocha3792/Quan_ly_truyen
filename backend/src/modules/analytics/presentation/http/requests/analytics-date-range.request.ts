import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class AnalyticsDateRangeRequest {
  @IsOptional() @Matches(DATE_PATTERN) from?: string;
  @IsOptional() @Matches(DATE_PATTERN) to?: string;
}

export class AnalyticsStoriesRequest extends AnalyticsDateRangeRequest {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
