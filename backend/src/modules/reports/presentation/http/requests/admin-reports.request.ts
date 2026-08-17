import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ReportReason, ReportStatus } from '@/generated/prisma/client';

export class ListAdminReportsRequest {
  @IsOptional() @IsEnum(ReportStatus) status?: ReportStatus;
  @IsOptional() @IsEnum(ReportReason) reason?: ReportReason;
  @IsOptional() @IsString() @MaxLength(160) reporter?: string;
  @IsOptional() @IsString() @MaxLength(160) reportedUser?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['createdAt', 'status', 'reason']) sort:
    'createdAt' | 'status' | 'reason' = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) direction: 'asc' | 'desc' = 'desc';
}

export class CloseReportRequest {
  @IsString() @MinLength(10) @MaxLength(2000) note!: string;
}
