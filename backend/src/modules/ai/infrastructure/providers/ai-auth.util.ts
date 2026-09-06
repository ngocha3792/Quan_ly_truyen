import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiAuthType } from '../../domain/enums';
import type { ResolvedAiConnection } from '../../application/ports';

const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const QUERY_NAME_PATTERN = /^[A-Za-z0-9._~-]+$/;
const FORBIDDEN_AUTH_HEADERS = new Set([
  'connection',
  'content-length',
  'cookie',
  'forwarded',
  'host',
  'keep-alive',
  'origin',
  'proxy-authorization',
  'proxy-authenticate',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
]);

export interface AuthenticatedRequestParts {
  readonly url: string;
  readonly headers: Headers;
}

export function applyAiCredential(
  connection: ResolvedAiConnection,
  rawUrl: string,
  initialHeaders: HeadersInit = {},
): AuthenticatedRequestParts {
  const url = new URL(rawUrl);
  const headers = new Headers(initialHeaders);

  switch (connection.authType) {
    case AiAuthType.BEARER:
      headers.set('Authorization', `Bearer ${connection.credential}`);
      break;
    case AiAuthType.X_API_KEY:
      headers.set('x-api-key', connection.credential);
      break;
    case AiAuthType.API_KEY_HEADER:
      headers.set(
        requireSafeAuthName(connection.authHeaderName, 'header'),
        connection.credential,
      );
      break;
    case AiAuthType.QUERY_PARAM:
      url.searchParams.set(
        requireSafeAuthName(connection.authHeaderName ?? 'key', 'query'),
        connection.credential,
      );
      break;
  }

  return { url: url.toString(), headers };
}

function requireSafeAuthName(
  name: string | null,
  location: 'header' | 'query',
): string {
  const validPattern =
    location === 'header' ? HEADER_NAME_PATTERN : QUERY_NAME_PATTERN;
  if (!name || !validPattern.test(name)) {
    throw new BusinessRuleViolationException({
      message: `Tên ${location === 'header' ? 'header' : 'query parameter'} xác thực không hợp lệ.`,
      rule: 'ai-connection.auth-name-invalid',
    });
  }

  if (location === 'header' && FORBIDDEN_AUTH_HEADERS.has(name.toLowerCase())) {
    throw new BusinessRuleViolationException({
      message: 'Header xác thực này không được phép sử dụng.',
      rule: 'ai-connection.auth-header-forbidden',
    });
  }

  return name;
}
