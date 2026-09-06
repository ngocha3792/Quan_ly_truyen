import type { AiModelInfo } from './ai-protocol-adapter.port';

export const AI_MODEL_CACHE_PORT = Symbol.for('modules.ai.model-cache');

export interface AiModelCachePort {
  get(connectionId: string): Promise<readonly AiModelInfo[] | null>;
  set(
    connectionId: string,
    models: readonly AiModelInfo[],
    ttlSeconds: number,
  ): Promise<void>;
  delete(connectionId: string): Promise<void>;
}
