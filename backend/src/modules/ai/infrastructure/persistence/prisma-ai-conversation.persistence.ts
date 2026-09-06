import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import type {
  AiConversation as PrismaAiConversation,
  AiMessage as PrismaAiMessage,
} from '@/generated/prisma/client';

import type { AiMessageRole, AiProtocol } from '../../domain/enums';
import {
  AiConversationPersistencePort,
  AiConversationRecord,
  AiMessageRecord,
} from '../../application/ports/ai-conversation.persistence.port';
import {
  toDomainAiMessageRole,
  toDomainAiProtocol,
  toLegacyPrismaAiProvider,
  toPrismaAiMessageRole,
  toPrismaAiProtocol,
  vendorHintFromLegacyProvider,
} from './ai-persistence.mappers';

function toDomainAiConversationRecord(
  record: PrismaAiConversation,
): AiConversationRecord {
  return {
    id: record.id,
    userId: record.userId,
    connectionId: record.connectionId,
    modelId: record.modelId,
    vendorHint:
      record.vendorHint ?? vendorHintFromLegacyProvider(record.legacyProvider),
    protocol: toDomainAiProtocol(record.protocol, record.legacyProvider),
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toDomainAiMessageRecord(record: PrismaAiMessage): AiMessageRecord {
  return {
    id: record.id,
    conversationId: record.conversationId,
    role: toDomainAiMessageRole(record.role),
    content: record.content,
    createdAt: record.createdAt,
  };
}

@Injectable()
export class PrismaAiConversationPersistence implements AiConversationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(userId: string): Promise<readonly AiConversationRecord[]> {
    const records = await this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return records.map(toDomainAiConversationRecord);
  }

  async findById(
    conversationId: string,
    userId: string,
  ): Promise<AiConversationRecord | null> {
    const record = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
    return record ? toDomainAiConversationRecord(record) : null;
  }

  async findMessages(
    conversationId: string,
  ): Promise<readonly AiMessageRecord[]> {
    const records = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toDomainAiMessageRecord);
  }

  async create(
    userId: string,
    connectionId: string | null,
    modelId: string | null,
    vendorHint: string | null,
    protocol: AiProtocol,
    title: string,
  ): Promise<AiConversationRecord> {
    const record = await this.prisma.aiConversation.create({
      data: {
        userId,
        connectionId,
        modelId,
        vendorHint,
        protocol: toPrismaAiProtocol(protocol),
        legacyProvider: toLegacyPrismaAiProvider(protocol, vendorHint),
        title,
      },
    });
    return toDomainAiConversationRecord(record);
  }

  async delete(conversationId: string, userId: string): Promise<void> {
    await this.prisma.aiConversation.deleteMany({
      where: { id: conversationId, userId },
    });
  }

  async appendMessage(
    conversationId: string,
    role: AiMessageRole,
    content: string,
  ): Promise<AiMessageRecord> {
    const record = await this.prisma.aiMessage.create({
      data: { conversationId, role: toPrismaAiMessageRole(role), content },
    });
    return toDomainAiMessageRecord(record);
  }

  async touch(
    conversationId: string,
    connectionId?: string | null,
  ): Promise<void> {
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        ...(connectionId !== undefined ? { connectionId } : {}),
      },
    });
  }
}
