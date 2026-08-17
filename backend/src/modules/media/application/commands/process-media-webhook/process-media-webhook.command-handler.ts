import { Inject, Injectable } from '@nestjs/common';

import {
  MEDIA_WEBHOOK_PORT,
  type MediaWebhookPort,
  type MediaWebhookResult,
} from '../../ports';
import { ProcessMediaWebhookCommand } from './process-media-webhook.command';

@Injectable()
export class ProcessMediaWebhookCommandHandler {
  constructor(
    @Inject(MEDIA_WEBHOOK_PORT)
    private readonly webhook: MediaWebhookPort,
  ) {}

  execute(command: ProcessMediaWebhookCommand): Promise<MediaWebhookResult> {
    return this.webhook.handle(command.input);
  }
}
