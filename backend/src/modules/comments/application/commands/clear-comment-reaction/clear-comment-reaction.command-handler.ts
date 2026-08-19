import { Inject, Injectable } from '@nestjs/common';
import {
  COMMENT_INTERACTION_PERSISTENCE_PORT,
  type CommentInteractionPersistencePort,
} from '../../ports';
import { ClearCommentReactionCommand } from './clear-comment-reaction.command';
@Injectable()
export class ClearCommentReactionCommandHandler {
  constructor(
    @Inject(COMMENT_INTERACTION_PERSISTENCE_PORT)
    private readonly persistence: CommentInteractionPersistencePort,
  ) {}
  execute(command: ClearCommentReactionCommand): Promise<void> {
    return this.persistence.clearReaction(command.input);
  }
}
