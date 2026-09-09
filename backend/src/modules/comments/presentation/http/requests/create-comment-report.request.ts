import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { COMMENT_REPORT_REASONS, type ReportReasonName } from '../../../domain';

export class CreateCommentReportRequest {
  @IsIn(COMMENT_REPORT_REASONS)
  reason!: ReportReasonName;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional() @IsUUID('4') anchorBlockId?: string;
  @IsOptional() @IsString() @MaxLength(500) anchorQuote?: string;
  @IsOptional() @IsInt() @Min(1) chapterVersion?: number;
}
