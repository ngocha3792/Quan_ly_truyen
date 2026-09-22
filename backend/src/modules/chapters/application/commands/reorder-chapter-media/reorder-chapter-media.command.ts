export class ReorderChapterMediaCommand {
  constructor(
    readonly userId: string | undefined,

    readonly storyId: string,

    readonly chapterId: string,

    readonly orderedMediaAssetIds: readonly string[],

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
