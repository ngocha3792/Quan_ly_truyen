import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InvalidInputException } from '@/common/exceptions';
import { readerFeaturesConfig } from '@/config';
import {
  CommentAnchorAccessDeniedException,
  CommentChapterNotFoundException,
  CommentStoryNotFoundException,
  InvalidCommentAnchorException,
  isComicCommentRegion,
  requireReaderUserId,
} from '../../../domain';
import type { StoryCommentResultDto } from '../../dto';
import {
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  COMMENT_WRITE_GUARD_PORT,
  type CommentMetricsPort,
  type CommentPersistencePort,
  type CommentWriteGuardPort,
} from '../../ports';
import { CreateComicRegionCommentCommand } from './create-comic-region-comment.command';

@Injectable()
export class CreateComicRegionCommentCommandHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    @Inject(COMMENT_WRITE_GUARD_PORT)
    private readonly abuse: CommentWriteGuardPort,
    @Inject(COMMENT_METRICS_PORT) private readonly metrics: CommentMetricsPort,
    @Inject(readerFeaturesConfig.KEY)
    private readonly features: ConfigType<typeof readerFeaturesConfig>,
  ) {}

  async execute(
    command: CreateComicRegionCommentCommand,
  ): Promise<StoryCommentResultDto> {
    if (
      !this.features.comicDeliveryEnabled ||
      !this.features.inlineCommentsEnabled
    ) {
      throw new InvalidInputException({
        code: 'READER_COMIC_COMMENTS_DISABLED',
        message: 'Bình luận truyện tranh chưa được bật',
      });
    }
    if (!isComicCommentRegion(command.region))
      throw new InvalidCommentAnchorException();
    const userId = requireReaderUserId(command.userId);
    const body = await this.abuse.prepare({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      body: command.body,
      ipAddress: command.ipAddress,
    });
    const result = await this.persistence.createComicRegionComment({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      mediaAssetId: command.mediaAssetId,
      body,
      region: command.region,
      createdAt: new Date(),
    });
    switch (result.status) {
      case 'created':
        this.metrics.recordOperation('create');
        return result.comment;
      case 'invalid_region':
        throw new InvalidCommentAnchorException();
      case 'access_denied':
        throw new CommentAnchorAccessDeniedException();
      case 'chapter_not_found':
        throw new CommentChapterNotFoundException(command.chapterId);
      default:
        throw new CommentStoryNotFoundException(command.storyId);
    }
  }
}
