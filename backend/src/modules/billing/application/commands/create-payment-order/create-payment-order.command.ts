export class CreatePaymentOrderCommand {
  constructor(
    readonly userId: string | undefined,
    readonly packageId: string,
    readonly idempotencyKey: string | undefined,
  ) {}
}
