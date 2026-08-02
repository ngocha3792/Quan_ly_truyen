export const JWT_BLACKLIST_PORT = Symbol('AUTH_JWT_BLACKLIST_PORT');

export interface BlacklistAccessTokenInput {
  tokenId: string;
  expiresAt: Date;
  reason: string;
}

export interface JwtBlacklistPort {
  isBlacklisted(tokenId: string): Promise<boolean>;

  blacklist(input: BlacklistAccessTokenInput): Promise<void>;
}
