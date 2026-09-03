export class SetCurrentSessionTrustCommand {
  constructor(
    readonly userId: string | undefined,
    readonly sessionId: string | undefined,
    readonly trusted: boolean,
  ) {}
}
