export interface RefreshTokenClientContext {
  ipAddress?: string;
  userAgent?: string;
}

export class RefreshTokenCommand {
  constructor(
    readonly refreshToken: string,
    readonly client: RefreshTokenClientContext,
  ) {}
}
