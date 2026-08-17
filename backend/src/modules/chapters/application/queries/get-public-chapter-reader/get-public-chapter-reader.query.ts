export class GetPublicChapterReaderQuery {
  constructor(
    readonly storySlug: string,
    readonly chapterNumber: string,
  ) {}
}
