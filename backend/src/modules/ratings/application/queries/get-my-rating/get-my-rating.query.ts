export class GetMyRatingQuery {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
  ) {}
}
