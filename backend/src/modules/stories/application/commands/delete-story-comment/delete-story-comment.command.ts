export class DeleteStoryCommentCommand {
  constructor(
    readonly userId: string | undefined,
    readonly commentId: string,
  ) {}
}
