import { Inject, Injectable } from '@nestjs/common';
import type { MediaAssetDto } from '../../dto';
import { MEDIA_COMMAND_PORT, type MediaCommandPort } from '../../ports';
import { ConfirmMediaUploadCommand } from './confirm-media-upload.command';
@Injectable()
export class ConfirmMediaUploadCommandHandler {
  constructor(@Inject(MEDIA_COMMAND_PORT) private readonly media: MediaCommandPort) {
  }
  execute(command: ConfirmMediaUploadCommand): Promise<MediaAssetDto> {
    return this.media.confirmUpload(command);
  }
}
