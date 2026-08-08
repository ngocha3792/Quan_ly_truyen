export class RevokeOtherSessionsCommand {
  constructor(
    readonly userId: string | undefined,

    readonly actorSessionId: string | undefined,
  ) {}
}
