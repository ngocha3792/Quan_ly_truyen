export class ListStoryRecommendationsQuery {
  constructor(
    readonly userId: string | undefined,
    readonly limit: number,
  ) {}
}
