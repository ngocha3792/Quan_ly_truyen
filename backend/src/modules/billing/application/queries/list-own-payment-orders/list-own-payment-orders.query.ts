export class ListOwnPaymentOrdersQuery {
  constructor(
    readonly userId: string | undefined,
    readonly page: number,
    readonly pageSize: number,
  ) {}
}
