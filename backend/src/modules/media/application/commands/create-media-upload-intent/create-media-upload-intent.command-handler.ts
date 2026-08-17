import { Inject, Injectable } from '@nestjs/common';
import type { SignedUploadParameters } from '../../ports';
import { MEDIA_COMMAND_PORT, type MediaCommandPort } from '../../ports';
import { CreateMediaUploadIntentCommand } from './create-media-upload-intent.command';
@Injectable()
export class CreateMediaUploadIntentCommandHandler {
  constructor(@Inject(MEDIA_COMMAND_PORT) private readonly media: MediaCommandPort) {
  }
  execute(command: CreateMediaUploadIntentCommand): Promise<SignedUploadParameters> {
    return this.media.createUploadIntent(command.input);
  }
}
