import { Inject, Injectable } from '@nestjs/common';
import type { CommentView } from '../../dto';
import {
  COMMENT_INTERACTION_PERSISTENCE_PORT,
  type CommentInteractionPersistencePort,
} from '../../ports';
import { CreateCommentReplyCommand } from './create-comment-reply.command';
@Injectable()
export class CreateCommentReplyCommandHandler {
  constructor(
    @Inject(COMMENT_INTERACTION_PERSISTENCE_PORT)
    private readonly persistence: CommentInteractionPersistencePort,
  ) {}
  execute(command: CreateCommentReplyCommand): Promise<CommentView> {
    return this.persistence.createReply(command.input);
  }
}
