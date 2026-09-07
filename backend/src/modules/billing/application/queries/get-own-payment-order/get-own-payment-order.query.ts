export class GetOwnPaymentOrderQuery {
  constructor(
    readonly userId: string | undefined,
    readonly orderId: string,
  ) {}
}
