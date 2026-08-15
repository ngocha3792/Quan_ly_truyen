export class UpdateStoryCommentCommand {
  constructor(
    readonly userId: string | undefined,
    readonly commentId: string,
    readonly body: string,
  ) {}
}
