import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import {
  ConcurrencyConflictException,
  InvalidInputException,
} from '@/common/exceptions';
import { readerFeaturesConfig } from '@/config';

import {
  ReadingHistoryChapterNotFoundException,
  ReadingHistoryStoryNotFoundException,
  parseReadingCursor,
  parseReadingProgressSyncMetadata,
} from '../../../domain';
import type { ReadingHistoryEntryResultDto } from '../../dto';
import {
  READING_HISTORY_PERSISTENCE_PORT,
  type ReadingHistoryPersistencePort,
  type SaveReadingProgressResult,
} from '../../ports';
import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import { SaveReadingProgressCommand } from './save-reading-progress.command';

@Injectable()
export class SaveReadingProgressCommandHandler {
  constructor(
    @Inject(READING_HISTORY_PERSISTENCE_PORT)
    private readonly persistence: ReadingHistoryPersistencePort,
    @Inject(readerFeaturesConfig.KEY)
    private readonly readerFeatures: ConfigType<typeof readerFeaturesConfig>,
  ) {}

  async execute(
    command: SaveReadingProgressCommand,
  ): Promise<ReadingHistoryEntryResultDto> {
    const result = await this.executeForSync(command);
    if (result.status === 'revision_conflict') {
      throw new ConcurrencyConflictException({
        code: 'READING_PROGRESS_REVISION_CONFLICT',
        resource: 'tiến độ đọc',
        identifier: command.storyId,
        details: {
          expectedRevision: result.expectedRevision,
          actualRevision: result.actualRevision,
        },
      });
    }

    return result.entry;
  }

  async executeForSync(
    command: SaveReadingProgressCommand,
  ): Promise<
    Exclude<
      SaveReadingProgressResult,
      | { readonly status: 'story_not_found' }
      | { readonly status: 'chapter_not_found' }
    >
  > {
    if (
      command.cursor !== undefined &&
      !this.readerFeatures.portableCursorEnabled
    ) {
      throw new InvalidInputException({
        code: 'READER_PORTABLE_CURSOR_DISABLED',
        message: 'Portable reader cursor chưa được bật',
      });
    }
    if (
      command.sync !== undefined &&
      !this.readerFeatures.realtimeProgressSyncEnabled
    ) {
      throw new InvalidInputException({
        code: 'READER_REALTIME_PROGRESS_SYNC_DISABLED',
        message: 'Đồng bộ realtime tiến độ đọc chưa được bật',
      });
    }

    const result = await this.persistence.saveProgress({
      userId: requireReadingHistoryUserId(command.userId),
      storyId: command.storyId,
      chapterId: command.chapterId,
      position: Math.max(0, Math.trunc(command.position)),
      cursor:
        command.cursor === undefined
          ? undefined
          : parseReadingCursor(command.cursor),
      sync:
        command.sync === undefined
          ? undefined
          : parseReadingProgressSyncMetadata(command.sync),
      readAt: new Date(),
    });

    if (result.status === 'story_not_found') {
      throw new ReadingHistoryStoryNotFoundException(command.storyId);
    }
    if (result.status === 'chapter_not_found') {
      throw new ReadingHistoryChapterNotFoundException(command.chapterId);
    }
    return result;
  }
}
