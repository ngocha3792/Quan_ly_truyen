import { Inject, Injectable } from '@nestjs/common';
import type { ReactionSummaryView } from '../../dto';
import {
  COMMENT_INTERACTION_PERSISTENCE_PORT,
  type CommentInteractionPersistencePort,
} from '../../ports';
import { SetCommentReactionCommand } from './set-comment-reaction.command';
@Injectable()
export class SetCommentReactionCommandHandler {
  constructor(
    @Inject(COMMENT_INTERACTION_PERSISTENCE_PORT)
    private readonly persistence: CommentInteractionPersistencePort,
  ) {}
  execute(command: SetCommentReactionCommand): Promise<ReactionSummaryView> {
    return this.persistence.setReaction(command.input);
  }
}
