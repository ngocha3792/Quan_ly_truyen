export class MailDeliveryException extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = MailDeliveryException.name;
  }
}
