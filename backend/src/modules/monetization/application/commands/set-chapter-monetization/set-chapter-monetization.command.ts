import type { ChapterAccessTypeName } from '../../../domain';

export class SetChapterMonetizationCommand {
  constructor(
    readonly actorId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly accessType: ChapterAccessTypeName,
    readonly priceBandId?: string,
    readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS',
    readonly freeAt?: Date,
    readonly paidWindowDays?: number,
    readonly ipAddress?: string,
    readonly userAgent?: string,
    readonly requestId?: string,
  ) {}
}
