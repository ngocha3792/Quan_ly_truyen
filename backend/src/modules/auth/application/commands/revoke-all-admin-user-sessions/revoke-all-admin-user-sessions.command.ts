export class RevokeAllAdminUserSessionsCommand {
  constructor(
    readonly actorUserId: string,
    readonly userId: string,
  ) {}
}
