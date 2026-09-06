import { Inject, Injectable } from '@nestjs/common';

import type { AiProvider } from '../../domain/enums';
import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
  AiConnectionRecord,
} from '../ports/ai-connection.persistence.port';

export interface ResolveAiConnectionParams {
  readonly userId: string;
  readonly connectionId?: string | null;
  readonly provider?: AiProvider;
}

/**
 * Picks which AiConnection a request should use: an explicitly requested
 * connection first (if it still belongs to the user or is a system
 * connection and is enabled), otherwise the user's own connection for the
 * given provider, otherwise a system-wide one for that provider.
 */
@Injectable()
export class AiConnectionResolver {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly connections: AiConnectionPersistencePort,
  ) {}

  async resolve(
    params: ResolveAiConnectionParams,
  ): Promise<AiConnectionRecord | null> {
    if (params.connectionId) {
      const requested = await this.connections.findById(params.connectionId);

      if (
        requested &&
        requested.enabled &&
        (requested.userId === params.userId || requested.userId === null)
      ) {
        return requested;
      }
    }

    if (!params.provider) {
      return null;
    }

    const personal = await this.connections.findFirstEnabledByOwnerAndProvider(
      params.userId,
      params.provider,
    );
    if (personal) {
      return personal;
    }

    return this.connections.findFirstEnabledByOwnerAndProvider(
      null,
      params.provider,
    );
  }
}
