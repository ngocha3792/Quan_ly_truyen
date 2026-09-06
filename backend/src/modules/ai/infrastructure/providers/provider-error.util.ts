import { AppException } from '@/common/exceptions';

import { AiProtocolRequestError } from '../../application/ports';
import { AiErrorCode } from '../../domain/enums';

export function toProviderTransportError(
  error: unknown,
  providerLabel: string,
): Error {
  if (
    error instanceof AppException ||
    error instanceof AiProtocolRequestError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return new AiProtocolRequestError(
      `${providerLabel} đã vượt quá thời gian chờ.`,
      null,
      AiErrorCode.TIMEOUT,
    );
  }

  // Do not copy fetch error messages: they may contain query-string API keys.
  return new AiProtocolRequestError(
    `Không thể kết nối tới ${providerLabel}.`,
    null,
    AiErrorCode.PROVIDER_UNAVAILABLE,
  );
}

export function sanitizeProviderErrorMessage(
  message: string | undefined,
  credential: string,
  fallback: string,
): string {
  if (!message) return fallback;

  const secrets = [credential, encodeURIComponent(credential)].filter(Boolean);
  let sanitized = message;
  for (const secret of secrets) {
    sanitized = sanitized.replaceAll(secret, '[REDACTED]');
  }

  sanitized = sanitized
    .replace(/\b(Bearer|Basic)\s+\S+/giu, '$1 [REDACTED]')
    .replace(
      /\b(api[_-]?key|token|authorization|credential)\s*[:=]\s*[^\s,;]+/giu,
      '$1=[REDACTED]',
    )
    .replace(
      /(https:\/\/[^\s?#]+(?:\/[^\s?#]*)?)\?[^\s#]*/giu,
      '$1?[REDACTED]',
    );

  return sanitized.slice(0, 500);
}
