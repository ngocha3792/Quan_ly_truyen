export const CSRF_TOKEN_PORT = Symbol('CSRF_TOKEN_PORT');

export interface ValidateCsrfTokenInput {
  refreshToken: string;
  cookieToken: string | undefined;
  headerToken: string | undefined;
}

export interface CsrfTokenPort {
  isEnabled(): boolean;
  issue(refreshToken: string, expiresAt: Date): string | undefined;
  assertValid(input: ValidateCsrfTokenInput): void;
}
