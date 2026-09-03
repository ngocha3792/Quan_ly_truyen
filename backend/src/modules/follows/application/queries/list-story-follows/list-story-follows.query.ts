export class ListStoryFollowsQuery {
  constructor(
    readonly userId: string,
    readonly storyIds: readonly string[],
  ) {}
}
