export class SubmitAuthorStoryCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly authorNote: string | undefined,
    readonly ipAddress: string | undefined,
    readonly userAgent: string | undefined,
    readonly requestId: string | undefined,
  ) {}
}
