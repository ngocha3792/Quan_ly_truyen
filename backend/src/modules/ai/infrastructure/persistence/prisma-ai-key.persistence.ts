import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';
import type { AiProvider } from '@/generated/prisma/client';

import {
  AiKeyPersistencePort,
  AiKeyRecord,
} from '../../application/ports/ai-key.persistence.port';

function systemKeyId(provider: AiProvider): string {
  return `system-${provider.toLowerCase()}`;
}

const SELECT = {
  provider: true,
  encryptedKey: true,
  updatedAt: true,
} as const;

@Injectable()
export class PrismaAiKeyPersistence implements AiKeyPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndProvider(
    userId: string | null,
    provider: AiProvider,
  ): Promise<AiKeyRecord | null> {
    if (userId === null) {
      return this.prisma.aiApiKey.findUnique({
        where: { id: systemKeyId(provider) },
        select: SELECT,
      });
    }

    return this.prisma.aiApiKey.findUnique({
      where: { userId_provider: { userId, provider } },
      select: SELECT,
    });
  }

  async listByUser(userId: string | null): Promise<readonly AiKeyRecord[]> {
    return this.prisma.aiApiKey.findMany({
      where: { userId },
      select: SELECT,
    });
  }

  async upsert(
    userId: string | null,
    provider: AiProvider,
    encryptedKey: string,
  ): Promise<void> {
    if (userId === null) {
      const id = systemKeyId(provider);
      await this.prisma.aiApiKey.upsert({
        where: { id },
        update: { encryptedKey },
        create: { id, userId: null, provider, encryptedKey },
      });
      return;
    }

    await this.prisma.aiApiKey.upsert({
      where: { userId_provider: { userId, provider } },
      update: { encryptedKey },
      create: { userId, provider, encryptedKey },
    });
  }

  async remove(userId: string | null, provider: AiProvider): Promise<void> {
    if (userId === null) {
      await this.prisma.aiApiKey.deleteMany({
        where: { id: systemKeyId(provider) },
      });
      return;
    }

    await this.prisma.aiApiKey.deleteMany({ where: { userId, provider } });
  }
}
