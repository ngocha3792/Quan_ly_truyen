export interface ImportChapterDraft {
  readonly title: string;

  readonly content: string;
}

/** Nhập nhiều chương nháp cùng lúc từ một bản thảo đã tách ở trình duyệt. */
export class ImportAuthorChaptersCommand {
  constructor(
    readonly userId: string | undefined,

    readonly storyId: string,

    readonly chapters: readonly ImportChapterDraft[],

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
