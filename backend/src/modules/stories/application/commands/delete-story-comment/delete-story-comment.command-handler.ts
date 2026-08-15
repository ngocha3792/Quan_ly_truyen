import { Inject, Injectable } from '@nestjs/common';
import { CommentNotFoundException } from '../../../domain';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { DeleteStoryCommentCommand } from './delete-story-comment.command';

@Injectable()
export class DeleteStoryCommentCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
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
  }
}
