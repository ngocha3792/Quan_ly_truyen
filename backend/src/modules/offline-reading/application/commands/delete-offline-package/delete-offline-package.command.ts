export class DeleteOfflinePackageCommand {
  constructor(
    readonly userId: string | undefined,
    readonly packageId: string,
  ) {}
}
