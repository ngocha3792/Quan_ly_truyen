import { InvalidInputException } from '@/common/exceptions';
import { Prisma, type RevenueAllocation } from '@/generated/prisma/client';
import {
  distributeRevenue,
  type RevenueShare,
} from '../../domain/policies/revenue-allocation.policy';
import { lockRevenueLedger, postRevenueJournal } from './revenue-journal';

export function agreementShares(agreement: {
  authorUserId: string;
  platformUserId: string | null;
  authorShare: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  contributorShares: Prisma.JsonValue;
}): RevenueShare[] {
  if (!agreement.platformUserId)
    throw new InvalidInputException({
      code: 'REVENUE_AGREEMENT_INVALID',
      message: 'Thỏa thuận chưa có tài khoản nền tảng.',
    });
  const contributors = Array.isArray(agreement.contributorShares)
    ? agreement.contributorShares
    : [];
  return [
    {
      userId: agreement.authorUserId,
      type: 'AUTHOR_SHARE',
      basisPoints: agreement.authorShare.mul(10000).toNumber(),
    },
    {
      userId: agreement.platformUserId,
      type: 'PLATFORM_FEE',
      basisPoints: agreement.platformFee.mul(10000).toNumber(),
    },
    ...contributors.map((value): RevenueShare => {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        typeof value.userId !== 'string' ||
        typeof value.shareBps !== 'number'
      ) {
        throw new InvalidInputException({
          code: 'REVENUE_AGREEMENT_INVALID',
          message: 'Tỷ lệ cộng tác viên không hợp lệ.',
        });
      }
      return {
        userId: value.userId,
        type: 'CONTRIBUTOR',
        basisPoints: value.shareBps,
      };
    }),
  ];
}

/** Called inside the purchase transaction, before entitlement is made durable. */
export async function allocatePurchaseRevenue(
  tx: Prisma.TransactionClient,
  purchaseId: string,
) {
  await lockRevenueLedger(tx);
  const existing = await tx.revenueAllocation.findMany({
    where: { purchaseId, isRefund: false },
  });
  if (existing.length) return existing;
  const policy = await tx.revenuePolicy.findUnique({
    where: { id: 'default' },
  });
  if (!policy?.enabled) return [];
  const purchase = await tx.chapterPurchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: { chapter: { select: { storyId: true } } },
  });
  if (purchase.status !== 'COMPLETED')
    throw new InvalidInputException({
      message: 'Chỉ phân bổ giao dịch mua chương thành công.',
    });
  const agreement = await tx.revenueShareAgreement.findFirst({
    where: {
      storyId: purchase.chapter.storyId,
      approvedAt: { not: null },
      effectiveFrom: { lte: purchase.createdAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: purchase.createdAt } }],
    },
    orderBy: { version: 'desc' },
  });
  if (!agreement)
    throw new InvalidInputException({
      code: 'REVENUE_AGREEMENT_REQUIRED',
      message:
        'Truyện chưa có thỏa thuận chia doanh thu được duyệt cho thời điểm mua.',
    });
  const shares = distributeRevenue(
    purchase.creditPrice,
    agreementShares(agreement),
  );
  const settlementDate = new Date(
    purchase.createdAt.getTime() + policy.settlementDelayDays * 86400000,
  );
  const allocations: RevenueAllocation[] = [];
  for (const share of shares) {
    const allocation = await tx.revenueAllocation.create({
      data: {
        purchaseId,
        agreementId: agreement.id,
        recipientUserId: share.userId,
        allocationType: share.type,
        grossAmount: purchase.creditPrice,
        shareBasisPoints: share.basisPoints,
        netAmount: share.amount,
        ...(share.type === 'PLATFORM_FEE'
          ? { status: 'SETTLED' as const, settledAt: purchase.createdAt }
          : {}),
      },
    });
    allocations.push(allocation);
    if (share.type !== 'PLATFORM_FEE')
      await tx.authorEarningLedger.create({
        data: {
          userId: share.userId,
          allocationId: allocation.id,
          amount: share.amount,
          settlementDate,
          status: 'PENDING',
        },
      });
  }
  await postRevenueJournal(tx, `purchase:${purchaseId}`, [
    { account: 'CLEARING', amount: -purchase.creditPrice },
    ...shares.map((share) => ({
      account: share.type === 'PLATFORM_FEE' ? 'PLATFORM' : 'PAYABLE',
      userId: share.userId,
      amount: share.amount,
    })),
  ]);
  await tx.auditLog.create({
    data: {
      action: 'revenue.purchase.allocated',
      entityType: 'chapter_purchase',
      entityId: purchaseId,
      newValues: {
        agreementId: agreement.id,
        agreementVersion: agreement.version,
        policyVersion: policy.version,
        grossCredits: purchase.creditPrice.toString(),
        settlementDate: settlementDate.toISOString(),
      },
    },
  });
  return allocations;
}

/** Compensate using the original snapshot, including after the policy has been disabled. */
export async function refundPurchaseRevenue(
  tx: Prisma.TransactionClient,
  purchaseId: string,
) {
  await lockRevenueLedger(tx);
  const originals = await tx.revenueAllocation.findMany({
    where: { purchaseId, isRefund: false },
    include: { earnings: true },
  });
  if (!originals.length) return;
  const purchase = await tx.chapterPurchase.findUniqueOrThrow({
    where: { id: purchaseId },
  });
  if (purchase.status !== 'REFUNDED')
    throw new InvalidInputException({
      message: 'Giao dịch mua chương chưa được hoàn.',
    });
  const now = purchase.refundedAt ?? new Date();
  for (const original of originals) {
    if (
      await tx.revenueAllocation.findUnique({
        where: { refundsAllocationId: original.id },
      })
    )
      continue;
    const compensation = await tx.revenueAllocation.create({
      data: {
        purchaseId,
        agreementId: original.agreementId,
        recipientUserId: original.recipientUserId,
        allocationType: original.allocationType,
        grossAmount: original.grossAmount,
        shareBasisPoints: original.shareBasisPoints,
        netAmount: -original.netAmount,
        status: 'SETTLED',
        settledAt: now,
        isRefund: true,
        refundsAllocationId: original.id,
      },
    });
    await tx.revenueAllocation.update({
      where: { id: original.id },
      data: { status: 'REFUNDED', refundedBy: compensation.id },
    });
    if (original.allocationType !== 'PLATFORM_FEE') {
      // A refunded pending earning and its negative counterpart become available
      // together and cancel out. Paid/reserved earnings produce debt instead.
      await tx.authorEarningLedger.updateMany({
        where: { allocationId: original.id, status: 'PENDING' },
        data: { status: 'AVAILABLE', availableAt: now },
      });
      await tx.authorEarningLedger.create({
        data: {
          userId: original.recipientUserId,
          allocationId: compensation.id,
          amount: -original.netAmount,
          status: 'AVAILABLE',
          settlementDate: now,
          availableAt: now,
        },
      });
    }
  }
  await postRevenueJournal(tx, `refund:${purchaseId}`, [
    { account: 'CLEARING', amount: purchase.creditPrice },
    ...originals.map((row) => ({
      account: row.allocationType === 'PLATFORM_FEE' ? 'PLATFORM' : 'PAYABLE',
      userId: row.recipientUserId,
      amount: -row.netAmount,
    })),
  ]);
  await tx.auditLog.create({
    data: {
      actorId: purchase.refundedById,
      action: 'revenue.purchase.compensated',
      entityType: 'chapter_purchase',
      entityId: purchaseId,
      newValues: {
        grossCredits: purchase.creditPrice.toString(),
        allocations: originals.length,
      },
    },
  });
}
