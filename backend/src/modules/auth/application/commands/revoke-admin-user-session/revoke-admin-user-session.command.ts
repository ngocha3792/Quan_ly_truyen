export class RevokeAdminUserSessionCommand {
  constructor(
    readonly actorUserId: string,
    readonly userId: string,
    readonly sessionId: string,
  ) {}
}
