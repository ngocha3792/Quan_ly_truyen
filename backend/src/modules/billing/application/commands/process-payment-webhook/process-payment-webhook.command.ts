export class ProcessPaymentWebhookCommand {
  constructor(
    readonly providerCode: string,
    readonly rawBody: Buffer,
    readonly headers: Readonly<Record<string, string | undefined>>,
  ) {}
}
