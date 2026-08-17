export class ListAuthorChaptersQuery {
  constructor(
    public readonly userId: string | undefined,
    public readonly storyId: string,
  ) {}
}
