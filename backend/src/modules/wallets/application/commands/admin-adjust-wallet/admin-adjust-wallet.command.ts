export class AdminAdjustWalletCommand {
  constructor(
    public readonly actorId: string | undefined,
    public readonly userId: string,
    public readonly direction: 'CREDIT' | 'DEBIT',
    public readonly amount: string,
    public readonly reason: string,
    public readonly idempotencyKey: string | undefined,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly requestId?: string,
  ) {}
}
