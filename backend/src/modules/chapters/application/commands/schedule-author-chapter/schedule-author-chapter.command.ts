export class ScheduleAuthorChapterCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly scheduledAt: string,
    readonly ipAddress: string | undefined,
    readonly userAgent: string | undefined,
    readonly requestId: string | undefined,
  ) {}
}
