export const SECURE_TOKEN_PORT = Symbol('AUTH_SECURE_TOKEN_PORT');

export interface SecureTokenPort {
  generate(): string;

  hash(token: string): string;

  equalsHash(leftHash: string, rightHash: string): boolean;
}
