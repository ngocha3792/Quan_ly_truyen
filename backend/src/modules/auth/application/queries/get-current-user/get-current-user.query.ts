export class GetCurrentUserQuery {
  constructor(
    readonly userId: string | undefined,
    readonly sessionId: string | undefined,
  ) {}
}
