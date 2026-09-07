import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  GetAiUsageSummaryQuery,
  GetAiUsageSummaryQueryHandler,
} from '../../../application';
import type { AiUsageSummary } from '../../../application/ports';
import { AdminAiUsageSummaryRequest } from '../requests';

@Controller('admin/ai/usage')
@RequirePermissions(PermissionCode.AI_SETTINGS_MANAGE)
export class AdminAiUsageController {
  constructor(private readonly summaryHandler: GetAiUsageSummaryQueryHandler) {}

  @Get()
  summary(
    @CurrentUserId() actorUserId: string | undefined,
    @Query() query: AdminAiUsageSummaryRequest,
  ): Promise<AiUsageSummary> {
    if (!actorUserId)
      throw new UnauthorizedException('Authentication required');
    return this.summaryHandler.execute(
      new GetAiUsageSummaryQuery(
        query.userId,
        query.from,
        query.to,
        query.userId,
      ),
    );
  }
}
