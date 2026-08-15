export class DeleteStoryRatingCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
  ) {}
}
