import type { AiProvider } from '../../domain/enums';
import type { AiProviderClientPort } from './ai-provider-client.port';

export const AI_PROVIDER_REGISTRY_PORT = Symbol.for(
  'modules.ai.provider-registry',
);

export interface AiProviderRegistryPort {
  getClient(provider: AiProvider): AiProviderClientPort;

  getModel(provider: AiProvider): string;
}
