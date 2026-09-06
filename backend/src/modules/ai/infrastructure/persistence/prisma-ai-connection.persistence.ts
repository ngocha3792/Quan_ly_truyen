import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import type { AiConnection as PrismaAiConnection } from '@/generated/prisma/client';

import type { AiProtocol } from '../../domain/enums';
import {
  AiConnectionPersistencePort,
  AiConnectionRecord,
  CreateAiConnectionInput,
  UpdateAiConnectionInput,
} from '../../application/ports/ai-connection.persistence.port';
import {
  baseUrlFromPersistence,
  legacyPrismaProvidersForProtocol,
  toDomainAiAuthType,
  toDomainAiProtocol,
  toLegacyPrismaAiProvider,
  toPrismaAiAuthType,
  toPrismaAiProtocol,
  vendorHintFromLegacyProvider,
} from './ai-persistence.mappers';

function toDomainAiConnectionRecord(
  record: PrismaAiConnection,
): AiConnectionRecord {
  const protocol = toDomainAiProtocol(record.protocol, record.legacyProvider);

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    vendorHint:
      record.vendorHint ?? vendorHintFromLegacyProvider(record.legacyProvider),
    protocol,
    authType: toDomainAiAuthType(record.authType, protocol),
    authHeaderName: record.authHeaderName,
    encryptedCredential:
      record.encryptedCredential ?? record.legacyEncryptedApiKey,
    baseUrl: baseUrlFromPersistence(
      record.baseUrl,
      protocol,
      record.legacyProvider,
    ),
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

  async findFirstEnabledByOwnerAndProtocol(
    userId: string | null,
    protocol: AiProtocol,
  ): Promise<AiConnectionRecord | null> {
    const record = await this.prisma.aiConnection.findFirst({
      where: {
        userId,
        enabled: true,
        OR: [
          { protocol: toPrismaAiProtocol(protocol) },
          {
            protocol: null,
            legacyProvider: {
              in: [...legacyPrismaProvidersForProtocol(protocol)],
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    return record ? toDomainAiConnectionRecord(record) : null;
  }

  async findFirstEnabledByOwner(
    userId: string | null,
  ): Promise<AiConnectionRecord | null> {
    const record = await this.prisma.aiConnection.findFirst({
      where: { userId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return record ? toDomainAiConnectionRecord(record) : null;
  }

  async create(input: CreateAiConnectionInput): Promise<AiConnectionRecord> {
    const record = await this.prisma.aiConnection.create({
      data: {
        userId: input.userId,
        name: input.name,
        vendorHint: input.vendorHint,
        protocol: toPrismaAiProtocol(input.protocol),
        authType: toPrismaAiAuthType(input.authType),
        authHeaderName: input.authHeaderName,
        encryptedCredential: input.encryptedCredential,
        legacyProvider: toLegacyPrismaAiProvider(
          input.protocol,
          input.vendorHint,
        ),
        legacyEncryptedApiKey: input.encryptedCredential,
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
        ...(input.encryptedCredential !== undefined
          ? {
              encryptedCredential: input.encryptedCredential,
              legacyEncryptedApiKey: input.encryptedCredential,
            }
          : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.defaultModel !== undefined
          ? { defaultModel: input.defaultModel }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.authType !== undefined
          ? { authType: toPrismaAiAuthType(input.authType) }
          : {}),
        ...(input.authHeaderName !== undefined
          ? { authHeaderName: input.authHeaderName }
          : {}),
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
