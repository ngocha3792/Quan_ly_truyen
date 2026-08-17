import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  COMMENT_REPORT_REASONS,
  type ReportReasonName,
} from '../../../domain';

export class CreateCommentReportRequest {
  @IsIn(COMMENT_REPORT_REASONS)
  reason!: ReportReasonName;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
