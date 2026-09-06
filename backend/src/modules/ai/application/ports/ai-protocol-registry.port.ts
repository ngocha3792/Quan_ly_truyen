import type { AiProtocol } from '../../domain/enums';
import type { AiProtocolAdapter } from './ai-protocol-adapter.port';

export const AI_PROTOCOL_REGISTRY_PORT = Symbol.for(
  'modules.ai.protocol-registry',
);

export interface AiProtocolRegistryPort {
  getAdapter(protocol: AiProtocol): AiProtocolAdapter;

  getDefaultModel(protocol: AiProtocol): string;
}
