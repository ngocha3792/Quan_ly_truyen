import type { ChapterAccessTypeName } from '../../../domain';

export class SetChapterMonetizationCommand {
  constructor(
    readonly actorId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly accessType: ChapterAccessTypeName,
    readonly priceBandId?: string,
    readonly ipAddress?: string,
    readonly userAgent?: string,
    readonly requestId?: string,
  ) {}
}
