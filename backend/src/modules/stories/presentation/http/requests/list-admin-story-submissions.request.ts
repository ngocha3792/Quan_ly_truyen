import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  STORY_SUBMISSION_STATUS_VALUES,
  type StorySubmissionStatusName,
} from '../../../domain';
import type { AdminStorySubmissionSort } from '../../../application';
export class ListAdminStorySubmissionsRequest {
  @IsOptional()
  @IsIn(STORY_SUBMISSION_STATUS_VALUES)
  status?: StorySubmissionStatusName;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(160)
  author?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  story?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(160)
  reviewer?: string;
  @IsOptional() @IsDateString() submittedFrom?: string;
  @IsOptional() @IsDateString() submittedTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional()
  @IsIn(['submittedAt:desc', 'submittedAt:asc'])
  sort: AdminStorySubmissionSort = 'submittedAt:desc';
}
