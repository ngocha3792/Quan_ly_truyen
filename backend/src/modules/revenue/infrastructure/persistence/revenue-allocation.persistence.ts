import { createHash } from 'node:crypto';
import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import { Prisma, type RevenueShareAgreement } from '@/generated/prisma/client';
import type {
  CreateRevenueAgreementInput,
  RevenueAllocationPort,
  RevenueAgreementView,
} from '../../application/ports/revenue-allocation.port';
import { distributeRevenue } from '../../domain/policies/revenue-allocation.policy';
import { lockRevenueLedger } from './revenue-journal';

@Injectable()
export class RevenueAllocationPersistence implements RevenueAllocationPort {
  constructor(private readonly prisma: PrismaService) {}

  createAgreement(input: CreateRevenueAgreementInput) {
    const contributors = [...(input.contributorShares ?? [])].sort((a, b) =>
      a.userId.localeCompare(b.userId),
    );
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify([
          input.actorId,
          input.storyId,
          input.authorShareBps,
          input.platformFeeBps,
          contributors,
          input.effectiveFrom ?? null,
        ]),
      )
      .digest('hex');
    if (
      !input.idempotencyKey ||
      input.idempotencyKey.length < 8 ||
      input.idempotencyKey.length > 200
    )
      throw new InvalidInputException({
        message: 'Thiếu mã yêu cầu idempotency hợp lệ.',
      });
    return this.prisma.$transaction(async (tx) => {
      await lockRevenueLedger(tx);
      const replay = await tx.revenueShareAgreement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (replay) {
        if (replay.requestHash !== requestHash)
          throw new InvalidInputException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Mã yêu cầu đã được dùng với nội dung khác.',
          });
        return toAgreement(replay);
      }
      const story = await tx.story.findFirst({
        where: { id: input.storyId, deletedAt: null },
        select: { authorId: true },
      });
      if (!story)
        throw new ResourceNotFoundException({
          resource: 'Truyện',
          identifier: input.storyId,
        });
      const policy = await tx.revenuePolicy.findUnique({
        where: { id: 'default' },
      });
      if (!policy?.platformUserId)
        throw new InvalidInputException({
          message: 'Cấu hình tài khoản nền tảng trước khi tạo thỏa thuận.',
        });
      if (input.platformFeeBps < policy.minimumPlatformFeeBasisPoints)
        throw new InvalidInputException({
          message: 'Tỷ lệ nền tảng thấp hơn chính sách tối thiểu.',
        });
      const shares = [
        {
          userId: story.authorId,
          type: 'AUTHOR_SHARE' as const,
          basisPoints: input.authorShareBps,
        },
        {
          userId: policy.platformUserId,
          type: 'PLATFORM_FEE' as const,
          basisPoints: input.platformFeeBps,
        },
        ...contributors.map((share) => ({
          userId: share.userId,
          type: 'CONTRIBUTOR' as const,
          basisPoints: share.shareBps,
        })),
      ];
      distributeRevenue(10000n, shares);
      const recipients = await tx.user.count({
        where: {
          id: { in: shares.map((share) => share.userId) },
          status: 'ACTIVE',
          deletedAt: null,
        },
      });
      if (recipients !== shares.length)
        throw new InvalidInputException({
          message: 'Tất cả người nhận phải là tài khoản đang hoạt động.',
        });
      const now = new Date();
      const effectiveFrom = input.effectiveFrom
        ? new Date(input.effectiveFrom)
        : now;
      if (!Number.isFinite(effectiveFrom.getTime()) || effectiveFrom < now)
        throw new InvalidInputException({
          message:
            'Thỏa thuận mới chỉ được áp dụng từ hiện tại hoặc tương lai.',
        });
      const latest = await tx.revenueShareAgreement.findFirst({
        where: { storyId: input.storyId },
        orderBy: { version: 'desc' },
      });
      if (latest && effectiveFrom <= latest.effectiveFrom)
        throw new InvalidInputException({
          message: 'Thời điểm áp dụng phải sau phiên bản thỏa thuận gần nhất.',
        });
      if (latest && (!latest.effectiveTo || latest.effectiveTo > effectiveFrom))
        await tx.revenueShareAgreement.update({
          where: { id: latest.id },
          data: { effectiveTo: effectiveFrom },
        });
      const agreement = await tx.revenueShareAgreement.create({
        data: {
          storyId: input.storyId,
          authorUserId: story.authorId,
          version: (latest?.version ?? 0) + 1,
          authorShare: new Prisma.Decimal(input.authorShareBps).div(10000),
          platformFee: new Prisma.Decimal(input.platformFeeBps).div(10000),
          contributorShares: contributors,
          platformUserId: policy.platformUserId,
          effectiveFrom,
          createdBy: input.actorId,
          approvedBy: input.actorId,
          approvedAt: now,
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'revenue.agreement.approved',
          entityType: 'revenue_share_agreement',
          entityId: agreement.id,
          newValues: {
            storyId: input.storyId,
            version: agreement.version,
            authorShareBps: input.authorShareBps,
            platformFeeBps: input.platformFeeBps,
            contributorShares: contributors,
            effectiveFrom: effectiveFrom.toISOString(),
          },
        },
      });
      return toAgreement(agreement);
    });
  }

  async listAgreements(storyId: string, userId?: string) {
    const agreements = await this.prisma.revenueShareAgreement.findMany({
      where: { storyId },
      orderBy: { version: 'desc' },
      take: 100,
    });
    if (userId) {
      const story = await this.prisma.story.findFirst({
        where: { id: storyId, authorId: userId, deletedAt: null },
        select: { id: true },
      });
      if (
        !story &&
        !agreements.some((agreement) =>
          toAgreement(agreement).contributorShares.some(
            (share) => share.userId === userId,
          ),
        )
      ) {
        throw new ForbiddenException({
          message: 'Bạn không có quyền xem thỏa thuận của truyện này.',
        });
      }
      return agreements
        .filter(
          (row) =>
            !!story ||
            toAgreement(row).contributorShares.some(
              (share) => share.userId === userId,
            ),
        )
        .map(toAgreement);
    }
    return agreements.map(toAgreement);
  }

  settlePending(limit = 100, now = new Date()) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new InvalidInputException({
        message: 'Số lượng đối soát phải từ 1 đến 500.',
      });
    return this.prisma.$transaction(async (tx) => {
      await lockRevenueLedger(tx);
      const earnings = await tx.authorEarningLedger.findMany({
        where: {
          status: 'PENDING',
          settlementDate: { lte: now },
          allocation: { status: 'PENDING', isRefund: false },
        },
        orderBy: [{ settlementDate: 'asc' }, { id: 'asc' }],
        take: limit,
      });
      if (!earnings.length) return { settled: 0 };
      await tx.revenueAllocation.updateMany({
        where: { id: { in: earnings.map((row) => row.allocationId) } },
        data: { status: 'SETTLED', settledAt: now },
      });
      await tx.authorEarningLedger.updateMany({
        where: { id: { in: earnings.map((row) => row.id) } },
        data: { status: 'AVAILABLE', availableAt: now },
      });
      await tx.auditLog.create({
        data: {
          action: 'revenue.earnings.settled',
          entityType: 'author_earning_ledger',
          newValues: {
            count: earnings.length,
            earningIds: earnings.map((row) => row.id),
          },
        },
      });
      return { settled: earnings.length };
    });
  }
}

function toAgreement(row: RevenueShareAgreement): RevenueAgreementView {
  const contributors = Array.isArray(row.contributorShares)
    ? row.contributorShares
    : [];
  return {
    id: row.id,
    storyId: row.storyId,
    version: row.version,
    authorUserId: row.authorUserId,
    authorShareBps: row.authorShare.mul(10000).toNumber(),
    platformFeeBps: row.platformFee.mul(10000).toNumber(),
    contributorShares: contributors.flatMap((item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof item.userId === 'string' &&
      typeof item.shareBps === 'number'
        ? [{ userId: item.userId, shareBps: item.shareBps }]
        : [],
    ),
    platformUserId: row.platformUserId,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}
