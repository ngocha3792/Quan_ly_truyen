import { Inject, Injectable } from '@nestjs/common';
import { CommentNotFoundException } from '../../../domain';
import {
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  type CommentMetricsPort,
  type CommentPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../../domain/policies/comment-auth.policy';
import { DeleteStoryCommentCommand } from './delete-story-comment.command';

@Injectable()
export class DeleteStoryCommentCommandHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    @Inject(COMMENT_METRICS_PORT)
    private readonly metrics: CommentMetricsPort,
  ) {}

  async execute(command: DeleteStoryCommentCommand): Promise<void> {
    const result = await this.persistence.deleteComment({
      userId: requireReaderUserId(command.userId),
      commentId: command.commentId,
      deletedAt: new Date(),
    });
    if (result.status === 'not_found') {
      throw new CommentNotFoundException(command.commentId);
    }
    this.metrics.recordOperation('delete');
  }
}
