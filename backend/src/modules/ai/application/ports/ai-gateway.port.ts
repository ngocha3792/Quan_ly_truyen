import type {
  ResolvedAiConnection,
  AiGenerateRequest,
  AiGenerateResponse,
  AiStreamEvent,
} from './ai-protocol-adapter.port';
import type { AiUsageCapabilityValue } from './ai-usage.persistence.port';

export const AI_GATEWAY_PORT = Symbol.for('modules.ai.gateway');

export interface AiUsageContext {
  readonly userId: string | null;
  readonly connectionId: string | null;
}

export interface AiSystemFallback {
  readonly connection: ResolvedAiConnection;
  readonly connectionId: string;
}

export interface AiGatewayPort {
  generate(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
    capability?: AiUsageCapabilityValue,
    systemFallback?: AiSystemFallback | null,
  ): Promise<AiGenerateResponse>;

  generateStream(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
    capability?: AiUsageCapabilityValue,
    systemFallback?: AiSystemFallback | null,
  ): AsyncIterable<AiStreamEvent>;
}
