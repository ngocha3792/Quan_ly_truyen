export class UpsertReadingGoalCommand {
  constructor(
    readonly userId: string | undefined,
    readonly targetChapters: number,
  ) {}
}
