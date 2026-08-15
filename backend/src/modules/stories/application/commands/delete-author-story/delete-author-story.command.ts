export class DeleteAuthorStoryCommand {
  constructor(
    readonly userId: string | undefined,

    readonly storyId: string,

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
