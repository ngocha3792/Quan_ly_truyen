export class TouchOfflinePackageCommand {
  constructor(
    readonly userId: string | undefined,
    readonly sessionId: string | undefined,
    readonly packageId: string,
  ) {}
}
