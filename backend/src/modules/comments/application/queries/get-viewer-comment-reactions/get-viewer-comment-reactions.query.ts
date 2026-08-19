export class GetViewerCommentReactionsQuery {
  constructor(
    readonly userId: string,
    readonly commentIds: readonly string[],
  ) {}
}
