export class GetAuthorChapterVersionQuery {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly version: number,
  ) {}
}
