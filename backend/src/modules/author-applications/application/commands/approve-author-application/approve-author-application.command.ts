export class ApproveAuthorApplicationCommand {
  constructor(
    readonly applicationId: string,

    readonly reviewerId: string | undefined,

    readonly ipAddress?: string,

    readonly userAgent?: string,

    readonly requestId?: string,
  ) {}
}
