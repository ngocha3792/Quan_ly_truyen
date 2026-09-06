import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import { AiUsageCapability } from '@/generated/prisma/client';

import {
  AiUsagePersistencePort,
  RecordAiUsageInput,
} from '../../application/ports/ai-usage.persistence.port';
import { toPrismaAiProvider } from './ai-persistence.mappers';

@Injectable()
export class PrismaAiUsagePersistence implements AiUsagePersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAiUsageInput): Promise<void> {
    await this.prisma.aiUsage.create({
      data: {
        userId: input.userId,
        connectionId: input.connectionId,
        provider: toPrismaAiProvider(input.provider),
        model: input.model,
        capability: AiUsageCapability[input.capability],
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        success: input.success,
        errorCode: input.errorCode,
      },
    });
  }
}
