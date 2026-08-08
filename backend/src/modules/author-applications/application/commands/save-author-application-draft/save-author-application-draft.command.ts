export class SaveAuthorApplicationDraftCommand {
  constructor(
    readonly userId: string | undefined,

    readonly penName: string | null | undefined,

    readonly fullName: string | null | undefined,

    readonly email: string | null | undefined,

    readonly phone: string | null | undefined,

    readonly portfolioUrl: string | null | undefined,

    readonly primaryGenre: string | null | undefined,

    readonly experience: string | null | undefined,

    readonly introduction: string | null | undefined,

    readonly firstWorkSynopsis: string | null | undefined,

    readonly acceptedTerms: boolean | undefined,
  ) {}
}
