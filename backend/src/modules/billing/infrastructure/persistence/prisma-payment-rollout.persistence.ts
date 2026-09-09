import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import type { PaymentRolloutPort } from '../../application/ports/payment-rollout.port';
import { BillingResourceNotFoundException } from '../../domain';

@Injectable()
export class PrismaPaymentRolloutPersistence implements PaymentRolloutPort {
  constructor(private readonly prisma: PrismaService) {}
  async get(storyId: string) {
    if (
      !(await this.prisma.story.findFirst({
        where: { id: storyId, deletedAt: null },
        select: { id: true },
      }))
    )
      throw new BillingResourceNotFoundException('truyện', storyId);
    const row = await this.prisma.storyPaymentAllowlist.findUnique({
      where: { storyId },
    });
    return {
      storyId,
      isEnabled: row?.isEnabled ?? false,
      enabledProviders: row?.enabledProviders ?? [],
    };
  }
  async update(
    actorId: string,
    storyId: string,
    input: { isEnabled: boolean; enabledProviders: string[] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM stories WHERE id = ${storyId}::uuid FOR UPDATE`,
      );
      if (
        !(await tx.story.findFirst({
          where: { id: storyId, deletedAt: null },
          select: { id: true },
        }))
      )
        throw new BillingResourceNotFoundException('truyện', storyId);
      const row = await tx.storyPaymentAllowlist.upsert({
        where: { storyId },
        create: { storyId, ...input, enabledBy: actorId },
        update: { ...input, enabledBy: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'payment.story-rollout.updated',
          entityType: 'story',
          entityId: storyId,
          newValues: input,
        },
      });
      return {
        storyId,
        isEnabled: row.isEnabled,
        enabledProviders: row.enabledProviders,
      };
    });
  }
  async allowed(storyId: string | undefined) {
    if (!storyId) return false;
    return !!(await this.prisma.storyPaymentAllowlist.findFirst({
      where: {
        storyId,
        isEnabled: true,
        enabledProviders: { has: 'VNPAY' },
        story: {
          deletedAt: null,
          visibility: 'PUBLIC',
          publishedAt: { not: null },
          status: { in: ['PUBLISHED', 'HIATUS', 'COMPLETED'] },
        },
      },
      select: { storyId: true },
    }));
  }
}
