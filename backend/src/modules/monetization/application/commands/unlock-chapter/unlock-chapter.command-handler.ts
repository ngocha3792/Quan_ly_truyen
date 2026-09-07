import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  assertUnlockChapterInput,
  requireMonetizationUserId,
} from '../../../domain';
import type { UnlockChapterResultDto } from '../../dto';
import { toUnlockChapterResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { UnlockChapterCommand } from './unlock-chapter.command';

@Injectable()
export class UnlockChapterCommandHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    command: UnlockChapterCommand,
  ): Promise<UnlockChapterResultDto> {
    const userId = requireMonetizationUserId(command.userId);
    const idempotencyKey = command.idempotencyKey?.trim() ?? '';
    assertUnlockChapterInput({
      userId,
      chapterId: command.chapterId,
      idempotencyKey,
    });
    const requestHash = createHash('sha256')
      .update(JSON.stringify([userId, command.chapterId, 'CHAPTER_PURCHASE']))
      .digest('hex');

    return toUnlockChapterResult(
      await this.persistence.unlockChapter({
        userId,
        chapterId: command.chapterId,
        idempotencyKey,
        requestHash,
        ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
        ...(command.userAgent ? { userAgent: command.userAgent } : {}),
        ...(command.requestId ? { requestId: command.requestId } : {}),
      }),
    );
  }
}
