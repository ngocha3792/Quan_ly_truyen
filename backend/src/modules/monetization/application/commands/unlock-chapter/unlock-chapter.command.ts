export class UnlockChapterCommand {
  constructor(
    readonly userId: string | undefined,
    readonly chapterId: string,
    readonly idempotencyKey: string | undefined,
    readonly ipAddress?: string,
    readonly userAgent?: string,
    readonly requestId?: string,
  ) {}
}
