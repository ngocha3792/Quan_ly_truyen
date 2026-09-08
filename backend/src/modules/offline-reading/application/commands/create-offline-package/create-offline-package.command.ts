export class CreateOfflinePackageCommand {
  constructor(
    readonly userId: string | undefined,
    readonly sessionId: string | undefined,
    readonly name: string,
    readonly description: string | undefined,
    readonly chapterIds: readonly string[],
  ) {}
}
