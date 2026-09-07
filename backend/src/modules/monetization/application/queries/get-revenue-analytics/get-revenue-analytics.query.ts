export class GetRevenueAnalyticsQuery {
  constructor(
    public readonly from?: string,
    public readonly to?: string,
    public readonly limit = 20,
  ) {}
}
