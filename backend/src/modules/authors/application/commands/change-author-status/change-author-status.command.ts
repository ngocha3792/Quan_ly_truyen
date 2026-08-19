import type { AuthorLifecycleStatus } from '../../../domain';
export class ChangeAuthorStatusCommand {
  constructor(
    readonly input: {
      actorUserId: string;
      authorId: string;
      status: AuthorLifecycleStatus;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    },
  ) {}
}
