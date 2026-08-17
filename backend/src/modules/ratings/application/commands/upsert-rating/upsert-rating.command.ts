export class UpsertRatingCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly score: number,
  ) {}
}
