import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import type { AiProvider } from '@/generated/prisma/client';

import {
  AiConnectionPersistencePort,
  AiConnectionRecord,
  CreateAiConnectionInput,
  UpdateAiConnectionInput,
} from '../../application/ports/ai-connection.persistence.port';

@Injectable()
export class PrismaAiConnectionPersistence implements AiConnectionPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(
    userId: string | null,
  ): Promise<readonly AiConnectionRecord[]> {
    return this.prisma.aiConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(connectionId: string): Promise<AiConnectionRecord | null> {
    return this.prisma.aiConnection.findUnique({ where: { id: connectionId } });
  }

  async findByOwnerAndId(
    userId: string | null,
    connectionId: string,
  ): Promise<AiConnectionRecord | null> {
    return this.prisma.aiConnection.findFirst({
      where: { id: connectionId, userId },
    });
  }

  async findFirstEnabledByOwnerAndProvider(
    userId: string | null,
    provider: AiProvider,
  ): Promise<AiConnectionRecord | null> {
    return this.prisma.aiConnection.findFirst({
      where: { userId, provider, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(input: CreateAiConnectionInput): Promise<AiConnectionRecord> {
    return this.prisma.aiConnection.create({
      data: {
        userId: input.userId,
        name: input.name,
        provider: input.provider,
        encryptedApiKey: input.encryptedApiKey,
        baseUrl: input.baseUrl,
        defaultModel: input.defaultModel,
      },
    });
  }

  async update(
    connectionId: string,
    input: UpdateAiConnectionInput,
  ): Promise<AiConnectionRecord> {
    return this.prisma.aiConnection.update({
      where: { id: connectionId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.encryptedApiKey !== undefined
          ? { encryptedApiKey: input.encryptedApiKey }
          : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.defaultModel !== undefined
          ? { defaultModel: input.defaultModel }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  }

  async delete(userId: string | null, connectionId: string): Promise<void> {
    await this.prisma.aiConnection.deleteMany({
      where: { id: connectionId, userId },
    });
  }
}
