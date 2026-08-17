export class CreateStoryCommentCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly body: string,
    readonly chapterId?: string,
    readonly ipAddress?: string,
  ) {}
}
