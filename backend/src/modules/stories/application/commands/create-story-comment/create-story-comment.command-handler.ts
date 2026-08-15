import { Inject, Injectable } from '@nestjs/common';
import {
  ChapterNotFoundException,
  InvalidCommentBodyException,
  ReaderEngagementPolicy,
  StoryNotFoundException,
} from '../../../domain';
import type { StoryCommentResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { CreateStoryCommentCommand } from './create-story-comment.command';

@Injectable()
export class CreateStoryCommentCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: CreateStoryCommentCommand): Promise<StoryCommentResultDto> {
    const body = ReaderEngagementPolicy.normalizeCommentBody(command.body);
    if (!ReaderEngagementPolicy.isValidCommentBody(body)) {
      throw new InvalidCommentBodyException();
    }

    const result = await this.persistence.createComment({
      userId: requireReaderUserId(command.userId),
      storyId: command.storyId,
      chapterId: command.chapterId,
      body,
      createdAt: new Date(),
    });

    switch (result.status) {
      case 'created':
        return result.comment;
      case 'chapter_not_found':
        throw new ChapterNotFoundException(command.chapterId);
      case 'story_not_found':
      default:
        throw new StoryNotFoundException(command.storyId);
    }
  }
}
