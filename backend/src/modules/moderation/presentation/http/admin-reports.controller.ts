import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ClientIp, CurrentUserId, RequestId, RequirePermissions, UserAgent } from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { AuthenticationRequiredException } from '@/common/exceptions';
import { ReportReason, ReportStatus } from '@/generated/prisma/client';
import { ModerationService } from '../../application';

class ListAdminReportsRequest {
  @IsOptional() @IsEnum(ReportStatus) status?: ReportStatus;
  @IsOptional() @IsEnum(ReportReason) reason?: ReportReason;
  @IsOptional() @IsString() @MaxLength(160) reporter?: string;
  @IsOptional() @IsString() @MaxLength(160) reportedUser?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['createdAt', 'status', 'reason']) sort: 'createdAt' | 'status' | 'reason' = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) direction: 'asc' | 'desc' = 'desc';
}

class CloseReportRequest {
  @IsString() @MinLength(10) @MaxLength(2000) note!: string;
}

@Controller('admin/reports')
@RequirePermissions(PermissionCode.REPORT_REVIEW)
export class AdminReportsController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  list(@Query() request: ListAdminReportsRequest) {
    return this.moderation.listReports({
      status: request.status,
      reason: request.reason,
      reporter: request.reporter,
      reportedUser: request.reportedUser,
      createdFrom: request.createdFrom ? new Date(request.createdFrom) : undefined,
      createdTo: request.createdTo ? new Date(request.createdTo) : undefined,
      page: request.page,
      pageSize: request.pageSize,
      sort: request.sort,
      direction: request.direction,
    });
  }

  @Get(':reportId')
  detail(@Param('reportId', new ParseUUIDPipe({ version: '4' })) reportId: string) {
    return this.moderation.getReport(reportId);
  }

  @Post(':reportId/resolve')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  resolve(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('reportId', new ParseUUIDPipe({ version: '4' })) reportId: string,
    @Body() request: CloseReportRequest,
  ) {
    return this.moderation.resolveReport({
      actorId: this.actor(actorId), reportId, note: request.note,
      audit: { ipAddress, userAgent, requestId },
    });
  }

  @Post(':reportId/reject')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  reject(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('reportId', new ParseUUIDPipe({ version: '4' })) reportId: string,
    @Body() request: CloseReportRequest,
  ) {
    return this.moderation.rejectReport({
      actorId: this.actor(actorId), reportId, note: request.note,
      audit: { ipAddress, userAgent, requestId },
    });
  }

  private actor(value: string | undefined): string {
    if (!value) throw new AuthenticationRequiredException();
    return value;
  }
}
