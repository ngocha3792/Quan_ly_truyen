export class CreateAuthorStoryCommand {
  constructor(
    readonly userId: string | undefined,

    readonly title: string,

    readonly synopsis: string | null | undefined,

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
