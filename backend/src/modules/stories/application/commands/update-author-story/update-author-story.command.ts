export class UpdateAuthorStoryCommand {
  constructor(
    readonly userId: string | undefined,

    readonly storyId: string,

    readonly title: string | undefined,

    readonly synopsis: string | null | undefined,

    readonly categoryIds: readonly string[] | undefined,

    readonly tagIds: readonly string[] | undefined,

    readonly coverMediaId: string | null | undefined,

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
