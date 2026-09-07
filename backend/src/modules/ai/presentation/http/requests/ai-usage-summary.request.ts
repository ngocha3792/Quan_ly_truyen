import { IsOptional, IsUUID, Matches } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class AiUsageSummaryRequest {
  @IsOptional()
  @Matches(DATE_PATTERN)
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  to?: string;
}

export class AdminAiUsageSummaryRequest extends AiUsageSummaryRequest {
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
