export class CreateAuthorChapterCommand {
  constructor(
    readonly userId: string | undefined,

    readonly storyId: string,

    readonly title: string,

    readonly content: string | null | undefined,

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
