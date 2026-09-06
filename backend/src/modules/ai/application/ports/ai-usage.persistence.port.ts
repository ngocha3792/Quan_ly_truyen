import type { AiProvider } from '../../domain/enums';

export const AI_USAGE_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.usage-persistence',
);

export type AiUsageCapabilityValue =
  'CHAT' | 'TRANSLATE' | 'SUMMARY' | 'REWRITE';

export interface RecordAiUsageInput {
  readonly userId: string | null;
  readonly connectionId: string | null;
  readonly provider: AiProvider;
  readonly model: string;
  readonly capability: AiUsageCapabilityValue;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly errorCode?: string;
}

export interface AiUsagePersistencePort {
  record(input: RecordAiUsageInput): Promise<void>;
}
