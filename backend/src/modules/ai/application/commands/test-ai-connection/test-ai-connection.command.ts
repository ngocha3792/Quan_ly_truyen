export class TestAiConnectionCommand {
  constructor(
    readonly userId: string | null,
    readonly connectionId: string,
    readonly actorUserId: string | null = userId,
  ) {}
}
