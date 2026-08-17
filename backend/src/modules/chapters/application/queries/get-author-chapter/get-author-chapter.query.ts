export class GetAuthorChapterQuery {
  constructor(
    public readonly userId: string | undefined,
    public readonly storyId: string,
    public readonly chapterId: string,
  ) {}
}
