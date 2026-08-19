export class ClearCommentReactionCommand {
  constructor(
    readonly input: { userId: string; commentId: string; ipAddress?: string },
  ) {}
}
