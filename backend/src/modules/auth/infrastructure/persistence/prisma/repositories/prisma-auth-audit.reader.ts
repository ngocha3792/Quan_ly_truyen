import { Injectable } from '@nestjs/common';

import type { Prisma } from '@/generated/prisma/client';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  AuthAuditReaderPort,
  AuthAuditRecord,
} from '../../../../application/ports';

@Injectable()
export class PrismaAuthAuditReader implements AuthAuditReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByUserId(
    userId: string,

    limit: number,
  ): Promise<readonly AuthAuditRecord[]> {
    try {
      const records = await this.prisma.auditLog.findMany({
        where: {
          actorId: userId,

          action: {
            startsWith: 'auth.',
          },
        },

        select: {
          id: true,

          action: true,

          entityType: true,

          entityId: true,

          metadata: true,

          ipAddress: true,

          userAgent: true,

          requestId: true,

          createdAt: true,
        },

        orderBy: [
          {
            createdAt: 'desc',
          },

          {
            id: 'desc',
          },
        ],

        take: limit,
      });

      return records.map((record) => ({
        ...record,

        metadata: toMetadata(record.metadata),
      }));
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-list-security-events',

        resource: 'Lịch sử bảo mật',
      });
    }
  }
}

function toMetadata(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}
