import { Inject, Injectable } from '@nestjs/common';

import {
  ContentTakedownPurchasesExistException,
  TakedownChapterNotFoundException,
  normalizeTakedownReason,
} from '../../../domain';
import {
  CONTENT_TAKEDOWN_PERSISTENCE_PORT,
  type ContentTakedownPersistencePort,
} from '../../ports';
import { TakeDownChapterCommand } from './take-down-chapter.command';

export interface TakeDownChapterOutcome {
  readonly chapterId: string;
  readonly storyId: string;
  readonly number: string;
  readonly title: string;
  readonly purchaseCount: number;
}

@Injectable()
export class TakeDownChapterCommandHandler {
  constructor(
    @Inject(CONTENT_TAKEDOWN_PERSISTENCE_PORT)
    private readonly persistence: ContentTakedownPersistencePort,
  ) {}

  async execute(
    command: TakeDownChapterCommand,
  ): Promise<TakeDownChapterOutcome> {
    const result = await this.persistence.takeDownChapter({
      actorId: command.actorId,
      chapterId: command.chapterId,
      reason: normalizeTakedownReason(command.reason),
      acknowledgePurchases: command.acknowledgePurchases,
      takenDownAt: new Date(),
      audit: command.audit,
    });

    switch (result.status) {
      case 'taken_down':
        return {
          chapterId: result.chapterId,
          storyId: result.storyId,
          number: result.number,
          title: result.title,
          purchaseCount: result.purchaseCount,
        };
      case 'purchases_exist':
        throw new ContentTakedownPurchasesExistException(result.purchaseCount);
      case 'not_found':
      default:
        throw new TakedownChapterNotFoundException(command.chapterId);
    }
  }
}
