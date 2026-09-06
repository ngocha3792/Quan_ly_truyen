import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import type { AiMessageRole, AiProvider } from '@/generated/prisma/client';

import {
  AiConversationPersistencePort,
  AiConversationRecord,
  AiMessageRecord,
} from '../../application/ports/ai-conversation.persistence.port';

@Injectable()
export class PrismaAiConversationPersistence implements AiConversationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(userId: string): Promise<readonly AiConversationRecord[]> {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(
    conversationId: string,
    userId: string,
  ): Promise<AiConversationRecord | null> {
    return this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
  }

  async findMessages(
    conversationId: string,
  ): Promise<readonly AiMessageRecord[]> {
    return this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    userId: string,
    provider: AiProvider,
    title: string,
  ): Promise<AiConversationRecord> {
    return this.prisma.aiConversation.create({
      data: { userId, provider, title },
    });
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
    return this.prisma.aiMessage.create({
      data: { conversationId, role, content },
    });
  }

  async touch(conversationId: string): Promise<void> {
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}
