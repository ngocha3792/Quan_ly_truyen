import type { ModerationAuditContext } from '../../ports';

export class TakeDownStoryCommand {
  constructor(
    readonly actorId: string,

    readonly storyId: string,

    readonly reason: string,

    readonly acknowledgePurchases: boolean,

    readonly audit: ModerationAuditContext,
  ) {}
}
