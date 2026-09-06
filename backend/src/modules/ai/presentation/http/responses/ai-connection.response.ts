import type { AiAuthType, AiProtocol } from '../../../domain/enums';
import type { AiConnectionRecord } from '../../../application/ports/ai-connection.persistence.port';

/**
 * Never includes the encrypted (or decrypted) API key — only metadata a
 * client needs to render a connection card.
 */
export interface AiConnectionResponse {
  readonly id: string;
  readonly name: string;
  /** @deprecated UI preset compatibility; routing uses protocol. */
  readonly provider: string;
  readonly vendorHint: string | null;
  readonly protocol: AiProtocol;
  readonly authType: AiAuthType;
  readonly authHeaderName: string | null;
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
    provider: record.vendorHint ?? record.protocol,
    vendorHint: record.vendorHint,
    protocol: record.protocol,
    authType: record.authType,
    authHeaderName: record.authHeaderName,
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
