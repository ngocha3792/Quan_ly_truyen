import { Inject, Injectable } from '@nestjs/common';

import {
  assertSetChapterPricingInput,
  requireMonetizationUserId,
} from '../../../domain';
import type { ChapterMonetizationResultDto } from '../../dto';
import { toChapterMonetizationResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { GetChapterMonetizationQuery } from './get-chapter-monetization.query';

@Injectable()
export class GetChapterMonetizationQueryHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    query: GetChapterMonetizationQuery,
  ): Promise<ChapterMonetizationResultDto> {
    const actorId = requireMonetizationUserId(query.actorId);
    assertSetChapterPricingInput({
      actorId,
      storyId: query.storyId,
      chapterId: query.chapterId,
      accessType: 'FREE',
    });
    return toChapterMonetizationResult(
      await this.persistence.getChapterMonetization({
        actorId,
        storyId: query.storyId,
        chapterId: query.chapterId,
      }),
    );
  }
}
