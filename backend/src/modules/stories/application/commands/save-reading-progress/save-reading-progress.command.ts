export class SaveReadingProgressCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly position: number,
  ) {}
}
