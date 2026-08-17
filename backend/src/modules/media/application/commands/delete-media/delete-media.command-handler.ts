import { Inject, Injectable } from '@nestjs/common';
import { MEDIA_CLEANUP_PORT, type MediaCleanupPort } from '../../ports';
import { DeleteMediaCommand } from './delete-media.command';
@Injectable()
export class DeleteMediaCommandHandler {
  constructor(@Inject(MEDIA_CLEANUP_PORT) private readonly cleanup: MediaCleanupPort) {
  }
  execute(command: DeleteMediaCommand): Promise<void> {
    return this.cleanup.deleteById(command.mediaId, command.principal);
  }
}
