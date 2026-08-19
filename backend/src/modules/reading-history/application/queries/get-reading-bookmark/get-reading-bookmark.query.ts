export class GetReadingBookmarkQuery {
  constructor(
    readonly userId: string | undefined,
    readonly chapterId: string,
  ) {}
}
