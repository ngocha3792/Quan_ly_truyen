export enum AiErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  RATE_LIMITED = 'RATE_LIMITED',
  INSUFFICIENT_CREDIT = 'INSUFFICIENT_CREDIT',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_NOT_ALLOWED = 'MODEL_NOT_ALLOWED',
  CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  UNKNOWN = 'UNKNOWN',
}

export function classifyAiErrorStatus(status: number | null): AiErrorCode {
  if (status === null) return AiErrorCode.TIMEOUT;
  if (status === 402) return AiErrorCode.INSUFFICIENT_CREDIT;
  if (status === 401 || status === 403) return AiErrorCode.INVALID_CREDENTIALS;
  if (status === 404) return AiErrorCode.MODEL_NOT_FOUND;
  if (status === 429) return AiErrorCode.RATE_LIMITED;
  if (status === 408) return AiErrorCode.TIMEOUT;
  if (status === 413) return AiErrorCode.CONTEXT_TOO_LARGE;
  if (status >= 500) return AiErrorCode.PROVIDER_UNAVAILABLE;
  return AiErrorCode.UNKNOWN;
}
