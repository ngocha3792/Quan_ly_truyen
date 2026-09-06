import type { AiProvider } from '@/generated/prisma/client';

export const AI_KEY_PERSISTENCE_PORT = Symbol.for('modules.ai.key-persistence');

export interface AiKeyRecord {
  readonly provider: AiProvider;
  readonly encryptedKey: string;
  readonly updatedAt: Date;
}

export interface AiKeyPersistencePort {
  findByUserAndProvider(
    userId: string | null,
    provider: AiProvider,
  ): Promise<AiKeyRecord | null>;

  listByUser(userId: string | null): Promise<readonly AiKeyRecord[]>;

  upsert(
    userId: string | null,
    provider: AiProvider,
    encryptedKey: string,
  ): Promise<void>;

  remove(userId: string | null, provider: AiProvider): Promise<void>;
}
