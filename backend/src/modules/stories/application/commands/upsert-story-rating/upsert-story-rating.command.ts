export class UpsertStoryRatingCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly score: number,
  ) {}
}
