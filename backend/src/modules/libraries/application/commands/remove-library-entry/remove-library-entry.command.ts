export class RemoveLibraryEntryCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
  ) {}
}
