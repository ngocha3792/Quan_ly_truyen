export class UnlockAdminUserCommand {
  constructor(
    readonly actorUserId: string,
    readonly userId: string,
  ) {}
}
