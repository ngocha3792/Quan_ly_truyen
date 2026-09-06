import type { AiProvider } from '../../../domain/enums';
import type { AiConnectionRecord } from '../../../application/ports/ai-connection.persistence.port';

/**
 * Never includes the encrypted (or decrypted) API key — only metadata a
 * client needs to render a connection card.
 */
export interface AiConnectionResponse {
  readonly id: string;
  readonly name: string;
  readonly provider: AiProvider;
  readonly baseUrl: string | null;
  readonly defaultModel: string | null;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toAiConnectionResponse(
  record: AiConnectionRecord,
): AiConnectionResponse {
  return {
    id: record.id,
    name: record.name,
    provider: record.provider,
    baseUrl: record.baseUrl,
    defaultModel: record.defaultModel,
    enabled: record.enabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toAiConnectionResponseList(
  records: readonly AiConnectionRecord[],
): readonly AiConnectionResponse[] {
  return records.map(toAiConnectionResponse);
}
