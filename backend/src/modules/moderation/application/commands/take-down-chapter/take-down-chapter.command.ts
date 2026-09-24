import type { ModerationAuditContext } from '../../ports';

export class TakeDownChapterCommand {
  constructor(
    readonly actorId: string,

    readonly chapterId: string,

    readonly reason: string,

    readonly acknowledgePurchases: boolean,

    readonly audit: ModerationAuditContext,
  ) {}
}
