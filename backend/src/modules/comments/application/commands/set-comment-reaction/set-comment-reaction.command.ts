import type { ReactionName } from '../../dto';
export class SetCommentReactionCommand {
  constructor(
    readonly input: {
      userId: string;
      commentId: string;
      type: ReactionName;
      ipAddress?: string;
    },
  ) {}
}
