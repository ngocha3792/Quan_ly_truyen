import { Inject, Injectable } from '@nestjs/common';

import { AiFallbackPolicy, type AiProtocol } from '../../domain/enums';
import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
  AiConnectionRecord,
} from '../ports/ai-connection.persistence.port';
import {
  AI_POLICY_PERSISTENCE_PORT,
  AiPolicyPersistencePort,
} from '../ports/ai-policy.persistence.port';

export interface ResolveAiConnectionParams {
  readonly userId: string;
  readonly connectionId?: string | null;
  readonly protocol?: AiProtocol;
}

export interface ResolvedAiConnectionPlan {
  readonly primary: AiConnectionRecord;
  readonly systemFallback: AiConnectionRecord | null;
  readonly fallbackPolicy: AiFallbackPolicy;
}

/**
 * Picks which AiConnection a request should use: an explicitly requested
 * connection first (if it still belongs to the user or is a system
 * connection and is enabled), otherwise the user's own connection for the
 * given protocol, otherwise a system-wide one for that protocol.
 */
@Injectable()
export class AiConnectionResolver {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly connections: AiConnectionPersistencePort,
    @Inject(AI_POLICY_PERSISTENCE_PORT)
    private readonly policies: AiPolicyPersistencePort,
  ) {}

  async resolve(
    params: ResolveAiConnectionParams,
  ): Promise<AiConnectionRecord | null> {
    return (await this.resolvePlan(params))?.primary ?? null;
  }

  async resolvePlan(
    params: ResolveAiConnectionParams,
  ): Promise<ResolvedAiConnectionPlan | null> {
    const policy = await this.policies.findByUserId(params.userId);
    const fallbackPolicy = policy?.fallbackPolicy ?? AiFallbackPolicy.NONE;

    if (params.connectionId) {
      const requested = await this.connections.findById(params.connectionId);

      if (requested?.enabled && requested.userId === params.userId) {
        return this.planForPersonal(requested, fallbackPolicy);
      }

      if (
        requested?.enabled &&
        requested.userId === null &&
        fallbackPolicy === AiFallbackPolicy.SYSTEM
      ) {
        return {
          primary: requested,
          systemFallback: null,
          fallbackPolicy,
        };
      }
    }

    if (!params.protocol) {
      const personal = await this.connections.findFirstEnabledByOwner(
        params.userId,
      );
      if (personal) return this.planForPersonal(personal, fallbackPolicy);

      if (fallbackPolicy !== AiFallbackPolicy.SYSTEM) return null;
      const system = await this.connections.findFirstEnabledByOwner(null);
      return system
        ? { primary: system, systemFallback: null, fallbackPolicy }
        : null;
    }

    const personal = await this.connections.findFirstEnabledByOwnerAndProtocol(
      params.userId,
      params.protocol,
    );
    if (personal) {
      return this.planForPersonal(personal, fallbackPolicy);
    }

    if (fallbackPolicy !== AiFallbackPolicy.SYSTEM) return null;

    const system = await this.connections.findFirstEnabledByOwnerAndProtocol(
      null,
      params.protocol,
    );
    return system
      ? { primary: system, systemFallback: null, fallbackPolicy }
      : null;
  }

  private async planForPersonal(
    personal: AiConnectionRecord,
    fallbackPolicy: AiFallbackPolicy,
  ): Promise<ResolvedAiConnectionPlan> {
    const systemFallback =
      fallbackPolicy === AiFallbackPolicy.SYSTEM
        ? await this.connections.findFirstEnabledByOwnerAndProtocol(
            null,
            personal.protocol,
          )
        : null;

    return { primary: personal, systemFallback, fallbackPolicy };
  }
}
