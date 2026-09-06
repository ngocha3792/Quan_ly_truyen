import type {
  AiConnectionConfig,
  AiGenerateRequest,
  AiGenerateResponse,
  AiStreamDelta,
} from './ai-provider-client.port';
import type { AiUsageCapabilityValue } from './ai-usage.persistence.port';

export const AI_GATEWAY_PORT = Symbol.for('modules.ai.gateway');

export interface AiUsageContext {
  readonly userId: string | null;
  readonly connectionId: string | null;
}

export interface AiGatewayPort {
  generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
    capability?: AiUsageCapabilityValue,
  ): Promise<AiGenerateResponse>;

  generateStream(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
    capability?: AiUsageCapabilityValue,
  ): AsyncIterable<AiStreamDelta>;
}
