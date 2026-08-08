export class RejectAuthorApplicationCommand {
  constructor(
    readonly applicationId: string,

    readonly reviewerId: string | undefined,

    readonly reason: string,

    readonly ipAddress?: string,

    readonly userAgent?: string,

    readonly requestId?: string,
  ) {}
}
