export class UnfollowStoryCommand {
  constructor(
    readonly userId: string,
    readonly storyId: string,
  ) {}
}
