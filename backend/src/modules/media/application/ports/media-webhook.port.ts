export interface MediaWebhookInput {
  readonly rawBody: Buffer;
  readonly timestamp: string;
  readonly signature: string;
}

export interface MediaWebhookResult {
  readonly duplicate: boolean;
  readonly eventKey: string;
}

export interface MediaWebhookPort {
  handle(input: MediaWebhookInput): Promise<MediaWebhookResult>;
}

export const MEDIA_WEBHOOK_PORT = Symbol('MEDIA_WEBHOOK_PORT');
