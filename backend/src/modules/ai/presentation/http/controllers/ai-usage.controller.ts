import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  GetAiUsageSummaryQuery,
  GetAiUsageSummaryQueryHandler,
} from '../../../application';
import type { AiUsageSummary } from '../../../application/ports';
import { AiUsageSummaryRequest } from '../requests';

@Controller('ai/usage')
@RequirePermissions(PermissionCode.AI_CHAT_USE)
export class AiUsageController {
  constructor(private readonly summaryHandler: GetAiUsageSummaryQueryHandler) {}

  @Get()
  summary(
    @CurrentUserId() userId: string | undefined,
    @Query() query: AiUsageSummaryRequest,
  ): Promise<AiUsageSummary> {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return this.summaryHandler.execute(
      new GetAiUsageSummaryQuery(userId, query.from, query.to),
    );
  }
}
