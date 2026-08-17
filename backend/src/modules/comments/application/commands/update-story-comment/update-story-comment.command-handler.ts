import { Inject, Injectable } from '@nestjs/common';
import {
  CommentNotFoundException,
  InvalidCommentBodyException,
  CommentPolicy,
} from '../../../domain';
import type { StoryCommentResultDto } from '../../dto';
import {
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  type CommentMetricsPort,
  type CommentPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../comment-auth.util';
import { UpdateStoryCommentCommand } from './update-story-comment.command';

@Injectable()
export class UpdateStoryCommentCommandHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    @Inject(COMMENT_METRICS_PORT)
    private readonly metrics: CommentMetricsPort,
  ) {}

  async execute(
    command: UpdateStoryCommentCommand,
  ): Promise<StoryCommentResultDto> {
    const body = command.body.trim();
    if (body.length < 1 || body.length > CommentPolicy.MAX_LENGTH) {
      throw new InvalidCommentBodyException();
    }

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
