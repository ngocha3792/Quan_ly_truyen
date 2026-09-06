import type { AiProvider } from '../../domain/enums';

export const AI_CONNECTION_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.connection-persistence',
);

export interface AiConnectionRecord {
  readonly id: string;
  readonly userId: string | null;
  readonly name: string;
  readonly provider: AiProvider;
  readonly encryptedApiKey: string;
  readonly baseUrl: string | null;
  readonly defaultModel: string | null;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAiConnectionInput {
  readonly userId: string | null;
  readonly name: string;
  readonly provider: AiProvider;
  readonly encryptedApiKey: string;
  readonly baseUrl: string | null;
  readonly defaultModel: string | null;
}

export interface UpdateAiConnectionInput {
  readonly name?: string;
  readonly encryptedApiKey?: string;
  readonly baseUrl?: string | null;
  readonly defaultModel?: string | null;
  readonly enabled?: boolean;
}

export interface AiConnectionPersistencePort {
  listByOwner(userId: string | null): Promise<readonly AiConnectionRecord[]>;

  findById(connectionId: string): Promise<AiConnectionRecord | null>;

  findByOwnerAndId(
    userId: string | null,
    connectionId: string,
  ): Promise<AiConnectionRecord | null>;

  findFirstEnabledByOwnerAndProvider(
    userId: string | null,
    provider: AiProvider,
  ): Promise<AiConnectionRecord | null>;

  findFirstEnabledByOwner(
    userId: string | null,
  ): Promise<AiConnectionRecord | null>;

  create(input: CreateAiConnectionInput): Promise<AiConnectionRecord>;

  update(
    connectionId: string,
    input: UpdateAiConnectionInput,
  ): Promise<AiConnectionRecord>;

  delete(userId: string | null, connectionId: string): Promise<void>;
}
