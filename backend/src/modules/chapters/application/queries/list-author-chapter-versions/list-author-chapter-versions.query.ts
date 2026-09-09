export class ListAuthorChapterVersionsQuery {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly page: number,
    readonly pageSize: number,
    readonly includeAutosaves = false,
  ) {}
}
