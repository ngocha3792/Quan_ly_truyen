export class DeleteAiConnectionCommand {
  constructor(
    readonly userId: string | null,
    readonly connectionId: string,
  ) {}
}
