import { Inject, Injectable } from '@nestjs/common';

import type { ResolvedAiConnection } from '../ports/ai-protocol-adapter.port';
import type { AiConnectionRecord } from '../ports/ai-connection.persistence.port';
import {
  AI_CREDENTIAL_VAULT_PORT,
  AiCredentialVaultPort,
} from '../ports/ai-credential-vault.port';
import {
  AI_PROTOCOL_REGISTRY_PORT,
  AiProtocolRegistryPort,
} from '../ports/ai-protocol-registry.port';

@Injectable()
export class AiResolvedConnectionFactory {
  constructor(
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly protocols: AiProtocolRegistryPort,
  ) {}

  async fromRecord(
    connection: AiConnectionRecord,
    modelOverride?: string | null,
  ): Promise<ResolvedAiConnection> {
    const model =
      modelOverride ??
      connection.defaultModel ??
      this.protocols.getDefaultModel(connection.protocol);

    return {
      protocol: connection.protocol,
      vendorHint: connection.vendorHint,
      baseUrl: connection.baseUrl,
      authType: connection.authType,
      authHeaderName: connection.authHeaderName,
      credential: await this.vault.decrypt(connection.encryptedCredential),
      model,
      capabilities:
        connection.capabilityModel === model
          ? (connection.capabilities ?? null)
          : null,
    };
  }
}
