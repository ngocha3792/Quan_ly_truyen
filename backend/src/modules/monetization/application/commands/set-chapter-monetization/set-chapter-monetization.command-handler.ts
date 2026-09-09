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
import { SetChapterMonetizationCommand } from './set-chapter-monetization.command';

@Injectable()
export class SetChapterMonetizationCommandHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    command: SetChapterMonetizationCommand,
  ): Promise<ChapterMonetizationResultDto> {
    const actorId = requireMonetizationUserId(command.actorId);
    const input = {
      actorId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      accessType: command.accessType,
      ...(command.priceBandId ? { priceBandId: command.priceBandId } : {}),
      ...(command.unlockPolicy ? { unlockPolicy: command.unlockPolicy } : {}),
      ...(command.freeAt ? { freeAt: command.freeAt } : {}),
      ...(command.paidWindowDays !== undefined
        ? { paidWindowDays: command.paidWindowDays }
        : {}),
      ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
      ...(command.userAgent ? { userAgent: command.userAgent } : {}),
      ...(command.requestId ? { requestId: command.requestId } : {}),
    };
    assertSetChapterPricingInput(input);
    return toChapterMonetizationResult(
      await this.persistence.setChapterMonetization(input),
    );
  }
}
