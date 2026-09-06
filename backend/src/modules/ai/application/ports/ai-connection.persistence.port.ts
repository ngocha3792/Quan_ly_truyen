import type { AiAuthType, AiProtocol } from '../../domain/enums';

export const AI_CONNECTION_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.connection-persistence',
);

export interface AiConnectionRecord {
  readonly id: string;
  readonly userId: string | null;
  readonly name: string;
  readonly vendorHint: string | null;
  readonly protocol: AiProtocol;
  readonly authType: AiAuthType;
  readonly authHeaderName: string | null;
  readonly encryptedCredential: string;
  readonly baseUrl: string;
  readonly defaultModel: string | null;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAiConnectionInput {
  readonly userId: string | null;
  readonly name: string;
  readonly vendorHint: string | null;
  readonly protocol: AiProtocol;
  readonly authType: AiAuthType;
  readonly authHeaderName: string | null;
  readonly encryptedCredential: string;
  readonly baseUrl: string;
  readonly defaultModel: string | null;
}

export interface UpdateAiConnectionInput {
  readonly name?: string;
  readonly encryptedCredential?: string;
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

  findFirstEnabledByOwnerAndProtocol(
    userId: string | null,
    protocol: AiProtocol,
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
