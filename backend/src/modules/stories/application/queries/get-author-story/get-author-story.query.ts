export class GetAuthorStoryQuery {
  constructor(
    public readonly userId: string | undefined,
    public readonly storyId: string,
  ) {}
}
