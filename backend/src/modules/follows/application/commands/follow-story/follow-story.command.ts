export class FollowStoryCommand {
  constructor(
    readonly userId: string,
    readonly storyId: string,
  ) {}
}
