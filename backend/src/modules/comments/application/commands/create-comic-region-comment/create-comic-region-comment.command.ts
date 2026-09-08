import type { ComicRegionInput } from '../../ports';

export class CreateComicRegionCommentCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly mediaAssetId: string,
    readonly body: string,
    readonly region: ComicRegionInput,
    readonly ipAddress?: string,
  ) {}
}
