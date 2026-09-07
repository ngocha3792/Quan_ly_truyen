export class UpdatePriceBandCommand {
  constructor(
    readonly actorId: string | undefined,
    readonly priceBandId: string,
    readonly label?: string,
    readonly creditPrice?: string,
    readonly isActive?: boolean,
    readonly sortOrder?: number,
    readonly ipAddress?: string,
    readonly userAgent?: string,
    readonly requestId?: string,
  ) {}
}
