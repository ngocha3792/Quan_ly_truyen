export class ListChapterCommentsQuery {
  constructor(
    readonly storySlug: string,
    readonly chapterNumber: string,
    readonly page: number,
    readonly pageSize: number,
  ) {}
}
