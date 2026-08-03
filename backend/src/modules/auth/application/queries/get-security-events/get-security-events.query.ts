export class GetSecurityEventsQuery {
  constructor(
    readonly userId: string | undefined,

    readonly requestedLimit: number,
  ) {}
}
