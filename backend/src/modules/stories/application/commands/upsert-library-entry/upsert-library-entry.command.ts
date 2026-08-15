import type { LibraryEntryStatus } from '../../ports';

export class UpsertLibraryEntryCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly status?: LibraryEntryStatus,
    readonly isFavorite?: boolean,
  ) {}
}
