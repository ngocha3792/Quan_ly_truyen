import { Inject, Injectable } from '@nestjs/common';
import { MetricsService } from '@/infrastructure/observability';
import { ChapterNotFoundException, StoryNotFoundException } from '../../../domain';
import { CommentWriteAbuseService } from '@/modules/comments';
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
    private readonly abuse: CommentWriteAbuseService,
    private readonly metrics: MetricsService,
  ) {}

  async execute(
    command: CreateStoryCommentCommand,
  ): Promise<StoryCommentResultDto> {
    const userId = requireReaderUserId(command.userId);
    const body = await this.abuse.prepare({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      body: command.body,
      ipAddress: command.ipAddress,
    });

    const result = await this.persistence.createComment({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      body,
      createdAt: new Date(),
    });

    switch (result.status) {
      case 'created':
        this.metrics.recordCommentOperation('create');
        return result.comment;
      case 'chapter_not_found':
        throw new ChapterNotFoundException(command.chapterId);
      case 'story_not_found':
      default:
        throw new StoryNotFoundException(command.storyId);
    }
  }
}
