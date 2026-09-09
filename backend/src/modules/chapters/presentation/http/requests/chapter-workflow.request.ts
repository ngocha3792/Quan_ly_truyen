import { Type } from 'class-transformer';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '@/common/constants';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ChapterWorkflowRequest {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ReviewChapterRequest extends ChapterWorkflowRequest {
  @IsIn(['APPROVED', 'REJECTED', 'REQUEST_CHANGES'])
  decision!: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}

export class ListChapterReviewsRequest {
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
  @Max(50)
  pageSize: number = DEFAULT_PAGE_LIMIT;

  @IsOptional()
  @IsIn(['IN_REVIEW'])
  status?: 'IN_REVIEW';
}

export class ChapterEditSessionRequest {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  tabId!: string;
}
