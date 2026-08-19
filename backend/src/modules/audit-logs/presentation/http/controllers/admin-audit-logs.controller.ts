import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  GetAuditLogDetailQuery,
  GetAuditLogDetailQueryHandler,
  ListAuditLogsQuery,
  ListAuditLogsQueryHandler,
} from '../../../application';

class ListAuditLogsRequest {
  @IsOptional() @IsUUID('4') actorId?: string;
  @IsOptional() @IsString() @MaxLength(120) action?: string;
  @IsOptional() @IsString() @MaxLength(100) entityType?: string;
  @IsOptional() @IsString() @MaxLength(100) entityId?: string;
  @IsOptional() @IsString() @MaxLength(100) requestId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

@Controller('admin/audit-logs')
@RequirePermissions(PermissionCode.AUDIT_LOG_READ)
export class AdminAuditLogsController {
  constructor(
    private readonly listAuditLogs: ListAuditLogsQueryHandler,
    private readonly getAuditLogDetail: GetAuditLogDetailQueryHandler,
  ) {}

  @Get()
  list(@Query() request: ListAuditLogsRequest) {
    return this.listAuditLogs.execute(
      new ListAuditLogsQuery({
        actorId: request.actorId,
        action: request.action?.trim() || undefined,
        entityType: request.entityType?.trim() || undefined,
        entityId: request.entityId?.trim() || undefined,
        requestId: request.requestId?.trim() || undefined,
        from: request.from ? new Date(request.from) : undefined,
        to: request.to ? new Date(request.to) : undefined,
        page: request.page,
        pageSize: request.pageSize,
      }),
    );
  }

  @Get(':auditLogId')
  detail(
    @Param('auditLogId', new ParseUUIDPipe({ version: '4' }))
    auditLogId: string,
  ) {
    return this.getAuditLogDetail.execute(
      new GetAuditLogDetailQuery(auditLogId),
    );
  }
}
