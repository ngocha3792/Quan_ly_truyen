export class CreateCommentReplyCommand {
  constructor(
    readonly input: {
      userId: string;
      parentCommentId: string;
      body: string;
      ipAddress?: string;
    },
  ) {}
}
