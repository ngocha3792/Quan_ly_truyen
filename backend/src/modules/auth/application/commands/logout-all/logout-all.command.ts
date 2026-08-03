export class LogoutAllCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,
  ) {}
}
