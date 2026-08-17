import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { AuthenticationRequiredException } from '@/common/exceptions';
import { ReportsService } from '../../../application';
import { CloseReportRequest, ListAdminReportsRequest } from '../requests';

@Controller('admin/reports')
@RequirePermissions(PermissionCode.REPORT_REVIEW)
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(@Query() request: ListAdminReportsRequest) {
    return this.reports.list({
      status: request.status,
      reason: request.reason,
      reporter: request.reporter,
      reportedUser: request.reportedUser,
      createdFrom: request.createdFrom
        ? new Date(request.createdFrom)
        : undefined,
      createdTo: request.createdTo ? new Date(request.createdTo) : undefined,
      page: request.page,
      pageSize: request.pageSize,
      sort: request.sort,
      direction: request.direction,
    });
  }

  @Get(':reportId')
  detail(
    @Param('reportId', new ParseUUIDPipe({ version: '4' })) reportId: string,
  ) {
    return this.reports.get(reportId);
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
    return this.reports.resolve({
      actorId: this.actor(actorId),
      reportId,
      note: request.note,
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
    return this.reports.reject({
      actorId: this.actor(actorId),
      reportId,
      note: request.note,
      audit: { ipAddress, userAgent, requestId },
    });
  }

  private actor(value: string | undefined): string {
    if (!value) throw new AuthenticationRequiredException();
    return value;
  }
}
