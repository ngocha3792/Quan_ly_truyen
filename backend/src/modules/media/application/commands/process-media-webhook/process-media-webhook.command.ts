import type { MediaWebhookInput } from '../../ports';

export class ProcessMediaWebhookCommand {
  constructor(readonly input: MediaWebhookInput) {}
}
