export class GetStoryFollowQuery {
  constructor(
    readonly userId: string,
    readonly storyId: string,
  ) {}
}
