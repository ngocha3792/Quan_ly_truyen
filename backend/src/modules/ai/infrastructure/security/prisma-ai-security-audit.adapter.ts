import { Injectable, Logger } from '@nestjs/common';

import { RequestContextStore } from '@/common/middlewares';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

import type {
  AiSecurityAuditPort,
  WriteAiSecurityAuditInput,
} from '../../application/ports/ai-security-audit.port';

@Injectable()
export class PrismaAiSecurityAuditAdapter implements AiSecurityAuditPort {
  private readonly logger = new Logger(PrismaAiSecurityAuditAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextStore,
  ) {}

  async record(input: WriteAiSecurityAuditInput): Promise<void> {
    const context = this.requestContext.get();
    const metadata = this.metadata(input, context);

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorUserId ?? undefined,
          action: input.action,
          entityType: 'AiConnection',
          entityId: input.connectionId,
          metadata,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          requestId: context?.requestId,
        },
      });
    } catch {
      // Never log the audit payload: a future caller could accidentally add secrets.
      this.logger.warn('AI security audit write failed');
    }
  }

  private metadata(
    input: WriteAiSecurityAuditInput,
    context: ReturnType<RequestContextStore['get']>,
  ): Prisma.InputJsonObject {
    const detail = input.metadata;
    return {
      actorType: input.actorUserId ? 'USER' : 'SYSTEM',
      ownerScope: input.ownerUserId ? 'USER' : 'SYSTEM',
      outcome: input.outcome,
      ...(context?.correlationId
        ? { correlationId: context.correlationId }
        : {}),
      ...(context?.sessionId ? { actorSessionId: context.sessionId } : {}),
      ...(detail?.protocol ? { protocol: detail.protocol } : {}),
      ...(detail?.authType ? { authType: detail.authType } : {}),
      ...(detail?.vendorHint !== undefined
        ? { vendorHint: detail.vendorHint }
        : {}),
      ...(detail?.model ? { model: detail.model } : {}),
      ...(detail?.changedFields
        ? { changedFields: [...detail.changedFields] }
        : {}),
      ...(detail?.failedChecks
        ? { failedChecks: [...detail.failedChecks] }
        : {}),
      ...(detail?.capabilities
        ? {
            capabilities: {
              chat: detail.capabilities.chat,
              modelDiscovery: detail.capabilities.modelDiscovery,
              streaming: detail.capabilities.streaming,
              systemPrompt: detail.capabilities.systemPrompt,
              tools: detail.capabilities.tools,
              vision: detail.capabilities.vision,
              reasoning: detail.capabilities.reasoning,
            },
          }
        : {}),
    };
  }
}
