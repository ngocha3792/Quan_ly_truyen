export class ListMyWalletTransactionsQuery {
  constructor(
    public readonly userId: string | undefined,
    public readonly page: number,
    public readonly pageSize: number,
  ) {}
}
