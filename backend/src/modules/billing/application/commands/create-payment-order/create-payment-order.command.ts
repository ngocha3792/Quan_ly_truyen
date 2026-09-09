export class CreatePaymentOrderCommand {
  constructor(
    readonly userId: string | undefined,
    readonly packageId: string,
    readonly idempotencyKey: string | undefined,
    readonly providerConnectionId?: string,
    readonly storyId?: string,
    readonly ipAddress?: string,
  ) {}
}
