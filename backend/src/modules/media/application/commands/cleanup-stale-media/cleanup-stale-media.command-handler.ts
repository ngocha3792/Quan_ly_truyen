import { Inject, Injectable } from '@nestjs/common';
import type { CleanupSummary } from '../../dto';
import { MEDIA_CLEANUP_PORT, type MediaCleanupPort } from '../../ports';
import { CleanupStaleMediaCommand } from './cleanup-stale-media.command';
@Injectable()
export class CleanupStaleMediaCommandHandler {
  constructor(
    @Inject(MEDIA_CLEANUP_PORT) private readonly cleanup: MediaCleanupPort,
  ) {}
  execute(command: CleanupStaleMediaCommand): Promise<CleanupSummary> {
    return this.cleanup.cleanupStaleMedia(command.options);
  }
}
