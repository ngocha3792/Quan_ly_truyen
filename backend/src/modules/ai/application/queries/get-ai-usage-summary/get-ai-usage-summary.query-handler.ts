import { Inject, Injectable } from '@nestjs/common';

import {
  AI_USAGE_READER_PORT,
  AiUsageReaderPort,
  AiUsageSummary,
} from '../../ports/ai-usage-reader.port';
import { GetAiUsageSummaryQuery } from './get-ai-usage-summary.query';

@Injectable()
export class GetAiUsageSummaryQueryHandler {
  constructor(
    @Inject(AI_USAGE_READER_PORT)
    private readonly reader: AiUsageReaderPort,
  ) {}

  execute(query: GetAiUsageSummaryQuery): Promise<AiUsageSummary> {
    return this.reader.summary({
      scopeUserId: query.scopeUserId,
      quotaUserId: query.quotaUserId,
      from: query.from,
      to: query.to,
    });
  }
}
