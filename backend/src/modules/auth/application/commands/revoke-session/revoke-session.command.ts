export class RevokeSessionCommand {
  constructor(
    readonly userId: string | undefined,
    readonly sessionId: string,
  ) {}
}
