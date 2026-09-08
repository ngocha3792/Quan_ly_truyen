export class SaveReadingProgressCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly position: number,
    readonly cursor?: unknown,
    readonly sync?: unknown,
  ) {}
}
