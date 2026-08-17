import { Inject, Injectable } from '@nestjs/common';
import type { ReactionName } from '../../dto';
import { COMMENT_INTERACTION_PERSISTENCE_PORT, type CommentInteractionPersistencePort } from '../../ports';
import { GetViewerCommentReactionsQuery } from './get-viewer-comment-reactions.query';
@Injectable()
export class GetViewerCommentReactionsQueryHandler {
  constructor(@Inject(COMMENT_INTERACTION_PERSISTENCE_PORT) private readonly persistence: CommentInteractionPersistencePort) {
  }
  execute(query: GetViewerCommentReactionsQuery): Promise<Record<string, ReactionName | null>> {
    return this.persistence.viewerReactions(query.userId, query.commentIds);
  }
}
