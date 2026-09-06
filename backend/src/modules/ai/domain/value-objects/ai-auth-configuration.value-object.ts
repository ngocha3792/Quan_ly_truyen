import { AiAuthType } from '../enums';

export function normalizeAiAuthHeaderName(
  authType: AiAuthType,
  configuredName?: string | null,
): string | null {
  const name = configuredName?.trim() || null;

  switch (authType) {
    case AiAuthType.BEARER:
      return null;
    case AiAuthType.X_API_KEY:
      return 'x-api-key';
    case AiAuthType.API_KEY_HEADER:
      return name;
    case AiAuthType.QUERY_PARAM:
      return name ?? 'key';
  }
}
