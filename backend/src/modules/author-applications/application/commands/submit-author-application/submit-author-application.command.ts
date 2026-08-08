export class SubmitAuthorApplicationCommand {
  constructor(
    readonly userId: string | undefined,

    readonly applicationId: string,

    readonly sampleMediaId: string,

    readonly ipAddress?: string,

    readonly userAgent?: string,

    readonly requestId?: string,
  ) {}
}
