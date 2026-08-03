export class RevokeSessionCommand {
  constructor(
    readonly userId: string | undefined,

    readonly actorSessionId: string | undefined,

    readonly sessionId: string,
  ) {}
}
