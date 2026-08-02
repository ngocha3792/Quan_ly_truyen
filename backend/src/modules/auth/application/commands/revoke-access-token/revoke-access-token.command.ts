export class RevokeAccessTokenCommand {
  constructor(
    readonly tokenId: string | undefined,
    readonly expiresAt: Date | undefined,
  ) {}
}
