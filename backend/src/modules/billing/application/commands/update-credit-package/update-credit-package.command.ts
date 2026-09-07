export class UpdateCreditPackageCommand {
  constructor(
    readonly actorId: string | undefined,
    readonly packageId: string,
    readonly label?: string,
    readonly creditAmount?: string,
    readonly fiatAmountMinor?: string,
    readonly currency?: string,
    readonly isActive?: boolean,
    readonly sortOrder?: number,
  ) {}
}
