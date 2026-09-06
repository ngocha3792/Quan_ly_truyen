import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';

import { AiErrorCode } from '../../../domain/enums';
import { AiResolvedConnectionFactory } from '../../connection-resolution';
import { AI_CAPABILITY_PROBE_TIMEOUT_MS } from '../../constants/ai-generation.constants';
import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../ports/ai-connection.persistence.port';
import {
  AiCapabilities,
  AiCapabilityName,
  AiCapabilityProbeResult,
  AiGenerateRequest,
  AiModelInfo,
  AiProtocolAdapter,
  AiProtocolRequestError,
  ResolvedAiConnection,
} from '../../ports/ai-protocol-adapter.port';
import {
  AI_PROTOCOL_REGISTRY_PORT,
  AiProtocolRegistryPort,
} from '../../ports/ai-protocol-registry.port';
import { ProbeAiConnectionCapabilitiesCommand } from './probe-ai-connection-capabilities.command';
import {
  AI_SECURITY_AUDIT_PORT,
  AiSecurityAuditPort,
} from '../../ports/ai-security-audit.port';
import { AI_EXTERNAL_OPERATION_REQUEST_COST } from '../../constants/ai-rate-limit.constants';
import { AiRateLimiter } from '../../policy';

const BASIC_PROBE_REQUEST: AiGenerateRequest = {
  messages: [{ role: 'user', content: 'Reply with OK.' }],
  maxOutputTokens: 8,
  timeoutMs: AI_CAPABILITY_PROBE_TIMEOUT_MS,
};

const SYSTEM_PROMPT_SENTINEL = 'CAPABILITY_OK';
const SYSTEM_PROMPT_PROBE_REQUEST: AiGenerateRequest = {
  systemPrompt: `Return exactly ${SYSTEM_PROMPT_SENTINEL}.`,
  messages: [{ role: 'user', content: 'Follow the system instruction.' }],
  maxOutputTokens: 16,
  timeoutMs: AI_CAPABILITY_PROBE_TIMEOUT_MS,
};

@Injectable()
export class ProbeAiConnectionCapabilitiesCommandHandler {
  private readonly logger = new Logger(
    ProbeAiConnectionCapabilitiesCommandHandler.name,
  );

  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    private readonly resolvedConnections: AiResolvedConnectionFactory,
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly protocols: AiProtocolRegistryPort,
    private readonly rateLimits: AiRateLimiter,
    @Inject(AI_SECURITY_AUDIT_PORT)
    private readonly audit: AiSecurityAuditPort,
  ) {}

  async execute(
    command: ProbeAiConnectionCapabilitiesCommand,
  ): Promise<AiCapabilityProbeResult> {
    const connection = await this.persistence.findByOwnerAndId(
      command.userId,
      command.connectionId,
    );
    if (!connection) {
      throw new ResourceNotFoundException({
        resource: 'kết nối AI',
        identifier: command.connectionId,
      });
    }

    const resolved = await this.resolvedConnections.fromRecord(connection);
    await this.rateLimits.reserveExternalRequests(
      command.actorUserId ?? command.userId,
      AI_EXTERNAL_OPERATION_REQUEST_COST.capabilityProbe,
    );
    const adapter = this.protocols.getAdapter(resolved.protocol);
    const failedChecks: AiCapabilityName[] = [];

    const models = await this.probeModels(adapter, resolved, failedChecks);
    const chat = await this.probeBoolean(
      'chat',
      resolved,
      failedChecks,
      async () =>
        Boolean(
          (
            await adapter.generate(resolved, BASIC_PROBE_REQUEST)
          ).content.trim(),
        ),
    );
    const systemPrompt = await this.probeBoolean(
      'systemPrompt',
      resolved,
      failedChecks,
      async () =>
        (await adapter.generate(resolved, SYSTEM_PROMPT_PROBE_REQUEST)).content
          .toUpperCase()
          .includes(SYSTEM_PROMPT_SENTINEL),
    );
    const streaming = await this.probeBoolean(
      'streaming',
      resolved,
      failedChecks,
      () => this.consumeProbeStream(adapter, resolved),
    );
    const selectedModel = models.items.find(
      (model) => model.id === resolved.model,
    );
    const capabilities: AiCapabilities = {
      chat,
      modelDiscovery: models.supported,
      streaming,
      systemPrompt,
      tools: selectedModel?.tools === true,
      vision: selectedModel?.vision === true,
      reasoning: selectedModel?.reasoning === true,
    };
    const probedAt = new Date();

    try {
      await this.persistence.update(connection.id, {
        expectedUpdatedAt: connection.updatedAt,
        capabilityModel: resolved.model,
        capabilities,
        capabilitiesProbedAt: probedAt,
      });
    } catch (error) {
      const current = await this.persistence.findByOwnerAndId(
        command.userId,
        command.connectionId,
      );
      if (
        current &&
        current.updatedAt.getTime() !== connection.updatedAt.getTime()
      ) {
        throw new BusinessRuleViolationException({
          message:
            'Kết nối đã thay đổi trong lúc dò capability. Hãy chạy lại probe.',
          rule: 'ai-connection.capability-probe-stale',
          cause: error,
        });
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: command.actorUserId,
      ownerUserId: command.userId,
      action: 'ai.capabilities.probed',
      connectionId: connection.id,
      outcome: failedChecks.length === 0 ? 'SUCCESS' : 'FAILURE',
      metadata: {
        protocol: connection.protocol,
        authType: connection.authType,
        vendorHint: connection.vendorHint,
        model: resolved.model,
        capabilities,
        failedChecks,
      },
    });

    return {
      connectionId: connection.id,
      model: resolved.model,
      capabilities,
      probedAt,
      failedChecks,
    };
  }

  private async probeModels(
    adapter: AiProtocolAdapter,
    connection: ResolvedAiConnection,
    failedChecks: AiCapabilityName[],
  ): Promise<{
    readonly supported: boolean;
    readonly items: readonly AiModelInfo[];
  }> {
    const startedAt = Date.now();
    try {
      const items = await adapter.listModels(connection);
      this.logResult(connection, 'modelDiscovery', true, startedAt);
      return { supported: true, items };
    } catch (error) {
      failedChecks.push('modelDiscovery');
      this.logResult(connection, 'modelDiscovery', false, startedAt, error);
      return { supported: false, items: [] };
    }
  }

  private async probeBoolean(
    capability: AiCapabilityName,
    connection: ResolvedAiConnection,
    failedChecks: AiCapabilityName[],
    operation: () => Promise<boolean>,
  ): Promise<boolean> {
    const startedAt = Date.now();
    try {
      const supported = await operation();
      if (!supported) failedChecks.push(capability);
      this.logResult(connection, capability, supported, startedAt);
      return supported;
    } catch (error) {
      failedChecks.push(capability);
      this.logResult(connection, capability, false, startedAt, error);
      return false;
    }
  }

  private async consumeProbeStream(
    adapter: AiProtocolAdapter,
    connection: ResolvedAiConnection,
  ): Promise<boolean> {
    let receivedText = false;
    let receivedDone = false;

    for await (const event of adapter.generateStream(
      connection,
      BASIC_PROBE_REQUEST,
    )) {
      if (event.type === 'TEXT_DELTA' && event.text.trim()) {
        receivedText = true;
      } else if (event.type === 'DONE') {
        receivedDone = true;
      }
    }

    return receivedText && receivedDone;
  }

  private logResult(
    connection: ResolvedAiConnection,
    capability: AiCapabilityName,
    supported: boolean,
    startedAt: number,
    error?: unknown,
  ): void {
    const event = {
      event: 'ai.capability-probe.completed',
      protocol: connection.protocol,
      vendorHint: connection.vendorHint,
      model: connection.model,
      capability,
      supported,
      latencyMs: Date.now() - startedAt,
      errorCode:
        error instanceof AiProtocolRequestError
          ? error.code
          : error
            ? AiErrorCode.UNKNOWN
            : undefined,
    };

    if (supported) this.logger.log(event);
    else this.logger.warn(event);
  }
}
