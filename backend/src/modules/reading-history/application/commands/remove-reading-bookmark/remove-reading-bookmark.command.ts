export class RemoveReadingBookmarkCommand {
  constructor(
    readonly userId: string | undefined,
    readonly chapterId: string,
  ) {}
}
