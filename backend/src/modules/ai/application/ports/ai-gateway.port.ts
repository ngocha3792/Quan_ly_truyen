import type {
  AiConnectionConfig,
  AiGenerateRequest,
  AiGenerateResponse,
} from './ai-provider-client.port';

export const AI_GATEWAY_PORT = Symbol.for('modules.ai.gateway');

export interface AiGatewayPort {
  generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse>;
}
