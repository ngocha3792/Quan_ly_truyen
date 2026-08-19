export class ListAuthorStoryAnalyticsQuery {
  constructor(
    readonly userId: string | undefined,
    readonly input: {
      from?: string;
      to?: string;
      page: number;
      pageSize: number;
    },
  ) {}
}
