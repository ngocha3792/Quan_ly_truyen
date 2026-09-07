export class GetAiUsageSummaryQuery {
  constructor(
    readonly scopeUserId: string | undefined,
    readonly from?: string,
    readonly to?: string,
    readonly quotaUserId: string | undefined = scopeUserId,
  ) {}
}
