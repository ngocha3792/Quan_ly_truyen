export class ListAiConnectionModelsQuery {
  constructor(
    readonly userId: string | null,
    readonly connectionId: string,
    readonly refresh = false,
    readonly actorUserId: string | null = userId,
  ) {}
}
