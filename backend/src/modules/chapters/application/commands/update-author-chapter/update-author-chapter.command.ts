export class UpdateAuthorChapterCommand {
  constructor(
    readonly userId: string | undefined,

    readonly storyId: string,

    readonly chapterId: string,

    readonly title: string | undefined,

    readonly content: string | null | undefined,

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
