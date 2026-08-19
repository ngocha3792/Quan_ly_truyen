import { Inject, Injectable } from '@nestjs/common';
import type { CommentPageView } from '../../dto';
import {
  COMMENT_INTERACTION_PERSISTENCE_PORT,
  type CommentInteractionPersistencePort,
} from '../../ports';
import { ListCommentRepliesQuery } from './list-comment-replies.query';
@Injectable()
export class ListCommentRepliesQueryHandler {
  constructor(
    @Inject(COMMENT_INTERACTION_PERSISTENCE_PORT)
    private readonly persistence: CommentInteractionPersistencePort,
  ) {}
  execute(query: ListCommentRepliesQuery): Promise<CommentPageView> {
    return this.persistence.listReplies(
      query.rootCommentId,
      query.page,
      query.pageSize,
    );
  }
}
