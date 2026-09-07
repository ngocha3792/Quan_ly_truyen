import { Type } from 'class-transformer';
import {
  IsDateString,
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

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/common/constants';
import { CHAPTER_PURCHASE_STATUSES } from '../../../domain';

export class AdminPurchaseExplorerRequest {
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
  @IsIn(CHAPTER_PURCHASE_STATUSES)
  status?: (typeof CHAPTER_PURCHASE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsOptional()
  @IsUUID('4')
  storyId?: string;

  @IsOptional()
  @IsUUID('4')
  authorId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RevenueAnalyticsRequest {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class RefundChapterPurchaseRequest {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
