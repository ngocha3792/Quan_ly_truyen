export interface AttachChapterMediaPage {
  readonly mediaAssetId: string;
  readonly altText?: string;
  readonly caption?: string;
}

export class AttachChapterMediaCommand {
  constructor(
    readonly userId: string | undefined,

    readonly storyId: string,

    readonly chapterId: string,

    readonly pages: readonly AttachChapterMediaPage[],

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
