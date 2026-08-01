const CREDENTIAL_URL_PATTERN =
  /\b(postgres(?:ql)?|rediss?|smtp):\/\/([^\s@/:]*):([^\s@]*)@/gi;
const SENSITIVE_QUERY_PATTERN =
  /(\b(?:password|token|api_key|api_secret|signature|auth_token)=)[^&#\s]*/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function sanitizeCredentialUrls(value: string): string {
  return value
    .replace(CREDENTIAL_URL_PATTERN, '$1://$2:***@')
    .replace(SENSITIVE_QUERY_PATTERN, '$1***')
    .replace(BEARER_PATTERN, 'Bearer ***')
    .replace(JWT_PATTERN, '[REDACTED_JWT]');
}

export function sanitizeErrorForLog(error: unknown): string {
  const raw =
    error instanceof Error ? (error.stack ?? error.message) : String(error);

  return sanitizeCredentialUrls(raw);
}
