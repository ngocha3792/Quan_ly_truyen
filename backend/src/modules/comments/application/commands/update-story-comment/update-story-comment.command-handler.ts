import { Inject, Injectable } from '@nestjs/common';
import { CommentNotFoundException } from '../../../domain';
import type { StoryCommentResultDto } from '../../dto';
import {
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  COMMENT_WRITE_GUARD_PORT,
  type CommentMetricsPort,
  type CommentPersistencePort,
  type CommentWriteGuardPort,
} from '../../ports';
import { requireReaderUserId } from '../../../domain/policies/comment-auth.policy';
import { UpdateStoryCommentCommand } from './update-story-comment.command';

@Injectable()
export class UpdateStoryCommentCommandHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    @Inject(COMMENT_METRICS_PORT)
    private readonly metrics: CommentMetricsPort,
    @Inject(COMMENT_WRITE_GUARD_PORT)
    private readonly writeGuard: CommentWriteGuardPort,
  ) {}

  async execute(
    command: UpdateStoryCommentCommand,
  ): Promise<StoryCommentResultDto> {
    const body = this.writeGuard.validateBody(command.body);

    const result = await this.persistence.updateComment({
      userId: requireReaderUserId(command.userId),
      commentId: command.commentId,
      body,
      updatedAt: new Date(),
    });
    if (result.status === 'not_found') {
      throw new CommentNotFoundException(command.commentId);
    }
    this.metrics.recordOperation('update');
    return result.comment;
  }
}
