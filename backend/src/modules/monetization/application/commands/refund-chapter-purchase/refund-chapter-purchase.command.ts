export class RefundChapterPurchaseCommand {
  constructor(
    public readonly actorId: string | undefined,
    public readonly purchaseId: string,
    public readonly reason: string,
    public readonly idempotencyKey: string | undefined,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly requestId?: string,
  ) {}
}
