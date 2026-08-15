import { Inject, Injectable } from '@nestjs/common';
import {
  CommentNotFoundException,
  InvalidCommentBodyException,
  ReaderEngagementPolicy,
} from '../../../domain';
import type { StoryCommentResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { UpdateStoryCommentCommand } from './update-story-comment.command';

@Injectable()
export class UpdateStoryCommentCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: UpdateStoryCommentCommand): Promise<StoryCommentResultDto> {
    const body = ReaderEngagementPolicy.normalizeCommentBody(command.body);
    if (!ReaderEngagementPolicy.isValidCommentBody(body)) {
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
    return result.comment;
  }
}
