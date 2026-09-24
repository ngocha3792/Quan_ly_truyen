import { Inject, Injectable } from '@nestjs/common';

import {
  ContentTakedownPurchasesExistException,
  TakedownStoryNotFoundException,
  normalizeTakedownReason,
} from '../../../domain';
import {
  CONTENT_TAKEDOWN_PERSISTENCE_PORT,
  type ContentTakedownPersistencePort,
} from '../../ports';
import { TakeDownStoryCommand } from './take-down-story.command';

export interface TakeDownStoryOutcome {
  readonly storyId: string;
  readonly title: string;
  readonly slug: string;
  /** Số chương còn sống bị gỡ theo truyện. */
  readonly chapterCount: number;
  readonly purchaseCount: number;
}

@Injectable()
export class TakeDownStoryCommandHandler {
  constructor(
    @Inject(CONTENT_TAKEDOWN_PERSISTENCE_PORT)
    private readonly persistence: ContentTakedownPersistencePort,
  ) {}

  async execute(command: TakeDownStoryCommand): Promise<TakeDownStoryOutcome> {
    const result = await this.persistence.takeDownStory({
      actorId: command.actorId,
      storyId: command.storyId,
      reason: normalizeTakedownReason(command.reason),
      acknowledgePurchases: command.acknowledgePurchases,
      takenDownAt: new Date(),
      audit: command.audit,
    });

    switch (result.status) {
      case 'taken_down':
        return {
          storyId: result.storyId,
          title: result.title,
          slug: result.slug,
          chapterCount: result.chapterCount,
          purchaseCount: result.purchaseCount,
        };
      case 'purchases_exist':
        throw new ContentTakedownPurchasesExistException(result.purchaseCount);
      case 'not_found':
      default:
        throw new TakedownStoryNotFoundException(command.storyId);
    }
  }
}
