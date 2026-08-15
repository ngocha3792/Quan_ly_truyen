export class RemoveReadingHistoryEntryCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
  ) {}
}
