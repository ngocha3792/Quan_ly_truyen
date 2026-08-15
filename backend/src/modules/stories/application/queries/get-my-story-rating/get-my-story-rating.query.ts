export class GetMyStoryRatingQuery {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
  ) {}
}
