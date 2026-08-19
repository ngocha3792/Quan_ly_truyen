export class UpsertReadingBookmarkCommand {
  constructor(
    readonly userId: string | undefined,
    readonly chapterId: string,
  ) {}
}
