export class DeleteAccountCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,

    readonly password: string,

    readonly confirmation: string,

    readonly requestIp?: string,

    readonly requestUserAgent?: string,
  ) {}
}
