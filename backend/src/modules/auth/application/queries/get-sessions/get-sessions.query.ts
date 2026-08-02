export class GetSessionsQuery {
  constructor(
    readonly userId: string | undefined,
    readonly currentSessionId: string | undefined,
  ) {}
}
