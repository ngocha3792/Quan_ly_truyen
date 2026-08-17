export class DeleteRatingCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
  ) {}
}
