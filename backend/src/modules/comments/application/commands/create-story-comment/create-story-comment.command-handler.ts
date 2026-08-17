import { Inject, Injectable } from '@nestjs/common';
import {
  CommentChapterNotFoundException,
  CommentStoryNotFoundException,
} from '../../../domain';
import { CommentWriteAbuseService } from '../../comment-write-abuse.service';
import type { StoryCommentResultDto } from '../../dto';
import {
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  type CommentMetricsPort,
  type CommentPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../comment-auth.util';
import { CreateStoryCommentCommand } from './create-story-comment.command';

@Injectable()
export class CreateStoryCommentCommandHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    private readonly abuse: CommentWriteAbuseService,
    @Inject(COMMENT_METRICS_PORT)
    private readonly metrics: CommentMetricsPort,
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
        this.metrics.recordOperation('create');
        return result.comment;
      case 'chapter_not_found':
        throw new CommentChapterNotFoundException(command.chapterId);
      case 'story_not_found':
      default:
        throw new CommentStoryNotFoundException(command.storyId);
    }
  }
}
