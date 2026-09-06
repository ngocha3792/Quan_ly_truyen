import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import type { AiConnection as PrismaAiConnection } from '@/generated/prisma/client';

import type { AiProvider } from '../../domain/enums';
import {
  AiConnectionPersistencePort,
  AiConnectionRecord,
  CreateAiConnectionInput,
  UpdateAiConnectionInput,
} from '../../application/ports/ai-connection.persistence.port';
import { toDomainAiProvider, toPrismaAiProvider } from './ai-persistence.mappers';

function toDomainAiConnectionRecord(
  record: PrismaAiConnection,
): AiConnectionRecord {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    provider: toDomainAiProvider(record.provider),
    encryptedApiKey: record.encryptedApiKey,
    baseUrl: record.baseUrl,
    defaultModel: record.defaultModel,
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaAiConnectionPersistence implements AiConnectionPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(
    userId: string | null,
  ): Promise<readonly AiConnectionRecord[]> {
    const records = await this.prisma.aiConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toDomainAiConnectionRecord);
  }

  async findById(connectionId: string): Promise<AiConnectionRecord | null> {
    const record = await this.prisma.aiConnection.findUnique({
      where: { id: connectionId },
    });
    return record ? toDomainAiConnectionRecord(record) : null;
  }

  async findByOwnerAndId(
    userId: string | null,
    connectionId: string,
  ): Promise<AiConnectionRecord | null> {
    const record = await this.prisma.aiConnection.findFirst({
      where: { id: connectionId, userId },
    });
    return record ? toDomainAiConnectionRecord(record) : null;
  }

  async findFirstEnabledByOwnerAndProvider(
    userId: string | null,
    provider: AiProvider,
  ): Promise<AiConnectionRecord | null> {
    const record = await this.prisma.aiConnection.findFirst({
      where: { userId, provider: toPrismaAiProvider(provider), enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return record ? toDomainAiConnectionRecord(record) : null;
  }

  async create(input: CreateAiConnectionInput): Promise<AiConnectionRecord> {
    const record = await this.prisma.aiConnection.create({
      data: {
        userId: input.userId,
        name: input.name,
        provider: toPrismaAiProvider(input.provider),
        encryptedApiKey: input.encryptedApiKey,
        baseUrl: input.baseUrl,
        defaultModel: input.defaultModel,
      },
    });
    return toDomainAiConnectionRecord(record);
  }

  async update(
    connectionId: string,
    input: UpdateAiConnectionInput,
  ): Promise<AiConnectionRecord> {
    const record = await this.prisma.aiConnection.update({
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
    return toDomainAiConnectionRecord(record);
  }

  async delete(userId: string | null, connectionId: string): Promise<void> {
    await this.prisma.aiConnection.deleteMany({
      where: { id: connectionId, userId },
    });
  }
}
