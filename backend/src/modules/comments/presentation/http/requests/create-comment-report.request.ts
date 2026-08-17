import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason } from '@/generated/prisma/client';

export class CreateCommentReportRequest {
  @IsEnum(ReportReason)
  reason!: keyof typeof ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
