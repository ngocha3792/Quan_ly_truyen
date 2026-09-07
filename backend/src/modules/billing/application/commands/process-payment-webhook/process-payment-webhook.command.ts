export class ProcessPaymentWebhookCommand {
  constructor(
    readonly providerCode: string,
    readonly rawBody: Buffer,
    readonly timestamp: string,
    readonly signature: string,
  ) {}
}
