import { Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import type {
  AuditLogRepositoryPort,
  ListAuditLogsInput,
} from '../application';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListAuditLogsInput) {
    const where = this.where(input);
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          requestId: true,
          createdAt: true,
          actor: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, totalItems };
  }

  findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      select: {
        id: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        requestId: true,
        createdAt: true,
        oldValues: true,
        newValues: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        actor: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  private where(input: ListAuditLogsInput): Prisma.AuditLogWhereInput {
    return {
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.from || input.to
        ? {
            createdAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    };
  }
}
