import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PayoutAccount,
  PayoutBatch,
  PayoutRequest,
  RevenuePolicy,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import {
  PayoutAccountInput,
  RevenuePayoutPort,
  RevenuePolicyInput,
} from '../../application/ports/revenue-payout.persistence.port';
import {
  calculatePayoutAmounts,
  MAX_PAYOUT_CREDITS,
  reserveEarningParts,
} from '../../domain/policies/payout.policy';
import { readRevenueReconciliation } from './revenue-reconciliation.reader';
import { postRevenueJournal } from './revenue-journal';

const HELD_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED'] as const;

@Injectable()
export class PrismaRevenuePayoutPersistence implements RevenuePayoutPort {
  constructor(private readonly prisma: PrismaService) {}

  private transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('revenue-ledger'))`;
      return run(tx);
    });
  }

  async getPolicy() {
    const policy = await this.prisma.revenuePolicy.findUnique({
      where: { id: 'default' },
    });
    return policy
      ? policyDto(policy)
      : {
          enabled: false,
          version: 0,
          settlementDelayDays: 7,
          minimumPayoutCredits: '100',
          feeBasisPoints: 0,
          taxBasisPoints: 0,
          fiatMinorPerCredit: '0',
          minimumPlatformFeeBasisPoints: 1000,
          platformUserId: null,
          currency: 'VND',
        };
  }

  async updatePolicy(actorId: string, input: RevenuePolicyInput) {
    const minimumPayout = BigInt(input.minimumPayoutCredits);
    const fiatMinorPerCredit = BigInt(input.fiatMinorPerCredit);
    if (
      input.settlementDelayDays < 1 ||
      input.settlementDelayDays > 365 ||
      minimumPayout < 1n ||
      minimumPayout > MAX_PAYOUT_CREDITS ||
      fiatMinorPerCredit < 0n ||
      fiatMinorPerCredit > 1_000_000n ||
      input.minimumPlatformFeeBasisPoints < 0 ||
      input.minimumPlatformFeeBasisPoints > 10_000 ||
      input.feeBasisPoints + input.taxBasisPoints >= 10_000 ||
      (input.enabled && (fiatMinorPerCredit <= 0n || !input.platformUserId))
    ) {
      throw new BadRequestException(
        'Cần cấu hình tỷ giá, tài khoản nền tảng và tổng phí/thuế hợp lệ trước khi bật doanh thu',
      );
    }
    return this.transaction(async (tx) => {
      if (
        input.platformUserId &&
        !(await tx.user.findFirst({
          where: { id: input.platformUserId, status: 'ACTIVE' },
        }))
      )
        throw new BadRequestException('Tài khoản nền tảng không hợp lệ');
      const previous = await tx.revenuePolicy.findUnique({
        where: { id: 'default' },
      });
      const data = {
        enabled: input.enabled,
        settlementDelayDays: input.settlementDelayDays,
        minimumPayoutCredits: minimumPayout,
        feeBasisPoints: input.feeBasisPoints,
        taxBasisPoints: input.taxBasisPoints,
        minimumPlatformFeeBasisPoints: input.minimumPlatformFeeBasisPoints,
        fiatMinorPerCredit,
        platformUserId: input.platformUserId ?? null,
        updatedBy: actorId,
      };
      const policy = await tx.revenuePolicy.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...data },
        update: { ...data, version: { increment: 1 } },
      });
      await audit(
        tx,
        actorId,
        'revenue.policy.updated',
        'revenue_policy',
        'default',
        { previousVersion: previous?.version ?? 0, version: policy.version },
      );
      return policyDto(policy);
    });
  }

  async getEarnings(userId: string) {
    const [earnings, requests, policy] = await Promise.all([
      this.prisma.authorEarningLedger.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          reservations: {
            where: { request: { status: { in: [...HELD_STATUSES] } } },
          },
        },
      }),
      this.prisma.payoutRequest.findMany({
        where: { userId, status: { in: [...HELD_STATUSES] } },
      }),
      this.getPolicy(),
    ]);
    const available = earnings
      .filter((e) => e.status !== 'PENDING')
      .reduce(
        (sum, e) =>
          sum +
          e.amount -
          e.reservations.reduce((held, r) => held + r.amount, 0n),
        0n,
      );
    return {
      available: available.toString(),
      pending: earnings
        .filter((e) => e.status === 'PENDING')
        .reduce((sum, e) => sum + e.amount, 0n)
        .toString(),
      reserved: requests
        .filter((r) => r.status !== 'COMPLETED')
        .reduce((sum, r) => sum + r.grossAmount, 0n)
        .toString(),
      paid: requests
        .filter((r) => r.status === 'COMPLETED')
        .reduce((sum, r) => sum + r.netAmount, 0n)
        .toString(),
      policy,
      items: earnings
        .slice(-100)
        .reverse()
        .map((e) => ({
          id: e.id,
          amount: e.amount.toString(),
          reservedAmount: e.reservations
            .reduce((sum, r) => sum + r.amount, 0n)
            .toString(),
          status: e.status,
          settlementDate: e.settlementDate.toISOString(),
          availableAt: e.availableAt?.toISOString() ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
    };
  }

  async listAccounts(userId?: string) {
    const rows = await this.prisma.payoutAccount.findMany({
      where: userId ? { userId } : {},
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return { items: rows.map(accountDto) };
  }

  async createAccount(userId: string, input: PayoutAccountInput) {
    if (
      input.method === 'BANK_TRANSFER'
        ? !input.bankName?.trim() || !input.accountNumber?.trim()
        : !input.walletPhone?.trim()
    )
      throw new BadRequestException('Thông tin nhận thanh toán chưa đầy đủ');
    return this.transaction(async (tx) => {
      const account = await tx.payoutAccount.create({
        data: {
          userId,
          method: input.method,
          bankName:
            input.method === 'BANK_TRANSFER' ? input.bankName?.trim() : null,
          accountNumber:
            input.method === 'BANK_TRANSFER'
              ? input.accountNumber?.trim()
              : null,
          accountName: input.accountName.trim(),
          walletPhone:
            input.method === 'BANK_TRANSFER' ? null : input.walletPhone?.trim(),
          kycReference: input.kycReference.trim(),
        },
      });
      await audit(
        tx,
        userId,
        'revenue.payout_account.created',
        'payout_account',
        account.id,
        { method: account.method },
      );
      return accountDto(account);
    });
  }

  async updateAccount(
    userId: string,
    id: string,
    input: { isActive?: boolean; isPrimary?: boolean },
  ) {
    return this.transaction(async (tx) => {
      const account = await tx.payoutAccount.findFirst({
        where: { id, userId },
      });
      if (!account)
        throw new NotFoundException('Không tìm thấy tài khoản nhận tiền');
      if (
        input.isPrimary &&
        (input.isActive === false ||
          (!account.isActive && input.isActive !== true))
      )
        throw new BadRequestException('Tài khoản chính phải đang hoạt động');
      if (input.isPrimary)
        await tx.payoutAccount.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false },
        });
      const changed = await tx.payoutAccount.update({
        where: { id },
        data: {
          ...input,
          ...(input.isActive === false ? { isPrimary: false } : {}),
        },
      });
      await audit(
        tx,
        userId,
        'revenue.payout_account.updated',
        'payout_account',
        id,
        input,
      );
      return accountDto(changed);
    });
  }

  async reviewAccount(
    actorId: string,
    id: string,
    input: { verified: boolean; reference: string },
  ) {
    return this.transaction(async (tx) => {
      const account = await tx.payoutAccount.findUnique({ where: { id } });
      if (!account?.kycReference)
        throw new BadRequestException('Cần tham chiếu xác minh danh tính');
      const changed = await tx.payoutAccount.update({
        where: { id },
        data: {
          isVerified: input.verified,
          verifiedAt: new Date(),
          verifiedBy: actorId,
          verificationReason: input.reference.trim(),
        },
      });
      await audit(
        tx,
        actorId,
        'revenue.payout_account.reviewed',
        'payout_account',
        id,
        { verified: input.verified, reference: input.reference },
      );
      return accountDto(changed);
    });
  }

  async listRequests(userId?: string) {
    const requests = await this.prisma.payoutRequest.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { items: requests.map(requestDto) };
  }

  async createRequest(
    userId: string,
    accountId: string,
    grossAmount: string,
    idempotencyKey: string,
  ) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/u.test(idempotencyKey))
      throw new BadRequestException(
        'Cần x-idempotency-key hợp lệ (8-128 ký tự)',
      );
    const key = `${userId}:${idempotencyKey}`;
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ userId, accountId, grossAmount }))
      .digest('hex');
    return this.transaction(async (tx) => {
      const replay = await tx.payoutRequest.findUnique({
        where: { idempotencyKey: key },
      });
      if (replay) {
        if (replay.requestHash !== requestHash)
          throw new ConflictException(
            'Idempotency key đã được dùng cho yêu cầu khác',
          );
        return requestDto(replay);
      }
      const policy = await tx.revenuePolicy.findUnique({
        where: { id: 'default' },
      });
      if (!policy?.enabled)
        throw new BadRequestException('Hệ thống rút tiền chưa được bật');
      const account = await tx.payoutAccount.findFirst({
        where: { id: accountId, userId, isActive: true, isVerified: true },
      });
      if (!account)
        throw new BadRequestException(
          'Cần tài khoản nhận tiền đã xác minh và đang hoạt động',
        );
      const snapshot = policyDto(policy);
      let amounts: ReturnType<typeof calculatePayoutAmounts>;
      try {
        amounts = calculatePayoutAmounts(BigInt(grossAmount), snapshot);
      } catch {
        throw new BadRequestException(
          'Số tiền rút hoặc chính sách phí không hợp lệ',
        );
      }
      const earnings = await tx.authorEarningLedger.findMany({
        where: { userId, status: { not: 'PENDING' } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          reservations: {
            where: { request: { status: { in: [...HELD_STATUSES] } } },
          },
        },
      });
      let parts: ReturnType<typeof reserveEarningParts>;
      try {
        parts = reserveEarningParts(
          earnings.map((e) => ({
            id: e.id,
            amount: e.amount,
            reservedAmount: e.reservations.reduce(
              (sum, r) => sum + r.amount,
              0n,
            ),
          })),
          amounts.gross,
        );
      } catch {
        throw new BadRequestException('Số dư doanh thu khả dụng không đủ');
      }
      const request = await tx.payoutRequest.create({
        data: {
          userId,
          accountId,
          grossAmount: amounts.gross,
          feeAmount: amounts.fee,
          taxAmount: amounts.tax,
          netAmount: amounts.net,
          fiatAmountMinor: amounts.fiatAmountMinor,
          currency: policy.currency,
          policySnapshot: snapshot,
          accountSnapshot: {
            method: account.method,
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            walletPhone: account.walletPhone,
          },
          idempotencyKey: key,
          requestHash,
        },
      });
      await tx.payoutEarningReservation.createMany({
        data: parts.map((p) => ({ requestId: request.id, ...p })),
      });
      await postRevenueJournal(tx, `payout:${request.id}:reserve`, [
        { account: 'PAYABLE', userId, amount: -amounts.gross },
        { account: 'RESERVED', userId, amount: amounts.gross },
      ]);
      await audit(
        tx,
        userId,
        'revenue.payout.requested',
        'payout_request',
        request.id,
        { grossAmount, policyVersion: policy.version },
      );
      return requestDto(request);
    });
  }

  async cancelRequest(userId: string, id: string) {
    return this.transaction(async (tx) => {
      const request = await tx.payoutRequest.findFirst({
        where: { id, userId },
      });
      if (!request)
        throw new NotFoundException('Không tìm thấy yêu cầu rút tiền');
      if (request.status === 'CANCELLED') return requestDto(request);
      if (request.status !== 'PENDING')
        throw new ConflictException('Chỉ được hủy yêu cầu đang chờ');
      const changed = await tx.payoutRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await postRevenueJournal(tx, `payout:${id}:release`, [
        { account: 'RESERVED', userId, amount: -request.grossAmount },
        { account: 'PAYABLE', userId, amount: request.grossAmount },
      ]);
      await audit(
        tx,
        userId,
        'revenue.payout.cancelled',
        'payout_request',
        id,
        {},
      );
      return requestDto(changed);
    });
  }

  async listBatches() {
    const batches = await this.prisma.payoutBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      items: batches.map(batchDto),
    };
  }

  async createBatch(actorId: string, requestIds: readonly string[]) {
    if (
      !requestIds.length ||
      requestIds.length > 100 ||
      new Set(requestIds).size !== requestIds.length
    )
      throw new BadRequestException('Chọn 1-100 yêu cầu khác nhau');
    const sortedRequestIds = [...requestIds].sort();
    const digest = createHash('sha256')
      .update(JSON.stringify(sortedRequestIds))
      .digest('hex');
    const idempotencyKey = `batch:${actorId}:${digest}`;
    return this.transaction(async (tx) => {
      const replay = await tx.payoutBatch.findUnique({
        where: { idempotencyKey },
        include: { requests: { select: { id: true } } },
      });
      if (replay) {
        const previousIds = replay.requests.map((request) => request.id).sort();
        if (
          replay.processedBy !== actorId ||
          JSON.stringify(previousIds) !== JSON.stringify(sortedRequestIds)
        )
          throw new ConflictException(
            'Đợt thanh toán không khớp yêu cầu trước đó',
          );
        return batchDto(replay);
      }
      const requests = await tx.payoutRequest.findMany({
        where: { id: { in: [...requestIds] }, status: 'PENDING' },
        include: { account: true },
      });
      if (
        requests.length !== requestIds.length ||
        requests.some((r) => !r.account.isVerified || !r.account.isActive)
      )
        throw new ConflictException(
          'Yêu cầu hoặc xác minh tài khoản đã thay đổi',
        );
      const batch = await tx.payoutBatch.create({
        data: {
          batchNumber: `PAYOUT_${randomUUID()}`,
          totalRequests: requests.length,
          totalAmount: requests.reduce((sum, r) => sum + r.netAmount, 0n),
          status: 'PROCESSING',
          processedBy: actorId,
          idempotencyKey,
        },
      });
      await tx.payoutRequest.updateMany({
        where: { id: { in: [...requestIds] } },
        data: {
          batchId: batch.id,
          status: 'PROCESSING',
          processedAt: new Date(),
        },
      });
      await audit(
        tx,
        actorId,
        'revenue.payout_batch.created',
        'payout_batch',
        batch.id,
        { requestIds: [...requestIds] },
      );
      return batchDto(batch);
    });
  }

  async exportBatch(actorId: string, id: string) {
    return this.transaction(async (tx) => {
      const batch = await tx.payoutBatch.findUnique({
        where: { id },
        include: { requests: true },
      });
      if (!batch) throw new NotFoundException('Không tìm thấy đợt thanh toán');
      await audit(
        tx,
        actorId,
        'revenue.payout_batch.exported',
        'payout_batch',
        id,
        {},
      );
      return {
        batchId: id,
        batchNumber: batch.batchNumber,
        items: batch.requests.map((r) => ({
          ...requestDto(r),
          payee: r.accountSnapshot,
        })),
      };
    });
  }

  async completeRequest(
    actorId: string,
    id: string,
    input: { providerTxnId: string; evidenceReference: string },
  ) {
    return this.transaction(async (tx) => {
      const request = await tx.payoutRequest.findUnique({ where: { id } });
      if (!request)
        throw new NotFoundException('Không tìm thấy yêu cầu rút tiền');
      if (
        request.status === 'COMPLETED' &&
        request.providerTxnId === input.providerTxnId
      )
        return requestDto(request);
      if (request.status !== 'PROCESSING')
        throw new ConflictException('Yêu cầu phải đang được xử lý');
      if (
        await tx.payoutRequest.findFirst({
          where: { providerTxnId: input.providerTxnId, id: { not: id } },
        })
      )
        throw new ConflictException('Mã chuyển tiền đã được sử dụng');
      const changed = await tx.payoutRequest.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          providerTxnId: input.providerTxnId,
          completedAt: new Date(),
        },
      });
      await postRevenueJournal(
        tx,
        `payout:${id}:paid`,
        [
          {
            account: 'RESERVED',
            userId: request.userId,
            amount: -request.grossAmount,
          },
          {
            account: 'PAID',
            userId: request.userId,
            amount: request.netAmount,
          },
          { account: 'FEE', amount: request.feeAmount },
          { account: 'TAX', amount: request.taxAmount },
        ].filter((e) => e.amount !== 0n),
      );
      await audit(
        tx,
        actorId,
        'revenue.payout.completed',
        'payout_request',
        id,
        input,
      );
      await closeBatch(tx, request.batchId);
      return requestDto(changed);
    });
  }

  async failRequest(
    actorId: string,
    id: string,
    input: { reason: string; evidenceReference: string },
  ) {
    return this.transaction(async (tx) => {
      const request = await tx.payoutRequest.findUnique({ where: { id } });
      if (!request)
        throw new NotFoundException('Không tìm thấy yêu cầu rút tiền');
      if (request.status !== 'PROCESSING')
        throw new ConflictException('Yêu cầu phải đang được xử lý');
      const changed = await tx.payoutRequest.update({
        where: { id },
        data: {
          status: 'FAILED',
          failureReason: input.reason,
          failedAt: new Date(),
        },
      });
      await postRevenueJournal(tx, `payout:${id}:release`, [
        {
          account: 'RESERVED',
          userId: request.userId,
          amount: -request.grossAmount,
        },
        {
          account: 'PAYABLE',
          userId: request.userId,
          amount: request.grossAmount,
        },
      ]);
      await audit(
        tx,
        actorId,
        'revenue.payout.failed',
        'payout_request',
        id,
        input,
      );
      await closeBatch(tx, request.batchId);
      return requestDto(changed);
    });
  }

  async reconcile() {
    return readRevenueReconciliation(this.prisma);
  }
}

async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonObject,
) {
  await tx.auditLog.create({
    data: { actorId, action, entityType, entityId, metadata },
  });
}
async function closeBatch(
  tx: Prisma.TransactionClient,
  batchId: string | null,
) {
  if (!batchId) return;
  const pending = await tx.payoutRequest.count({
    where: { batchId, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (!pending)
    await tx.payoutBatch.update({
      where: { id: batchId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
}
function policyDto(p: RevenuePolicy) {
  return {
    enabled: p.enabled,
    version: p.version,
    settlementDelayDays: p.settlementDelayDays,
    minimumPayoutCredits: p.minimumPayoutCredits.toString(),
    feeBasisPoints: p.feeBasisPoints,
    taxBasisPoints: p.taxBasisPoints,
    fiatMinorPerCredit: p.fiatMinorPerCredit.toString(),
    minimumPlatformFeeBasisPoints: p.minimumPlatformFeeBasisPoints,
    platformUserId: p.platformUserId,
    currency: p.currency,
  };
}
function accountDto(a: PayoutAccount) {
  return {
    id: a.id,
    userId: a.userId,
    method: a.method,
    bankName: a.bankName,
    accountName: a.accountName,
    accountNumberMasked: mask(a.accountNumber),
    walletPhoneMasked: mask(a.walletPhone),
    isActive: a.isActive,
    isPrimary: a.isPrimary,
    isVerified: a.isVerified,
    kycReference: a.kycReference,
    verificationReason: a.verificationReason,
    verifiedAt: a.verifiedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}
function requestDto(r: PayoutRequest) {
  return {
    id: r.id,
    userId: r.userId,
    accountId: r.accountId,
    batchId: r.batchId,
    grossAmount: r.grossAmount.toString(),
    feeAmount: r.feeAmount.toString(),
    taxAmount: r.taxAmount.toString(),
    netAmount: r.netAmount.toString(),
    fiatAmountMinor: r.fiatAmountMinor?.toString() ?? null,
    currency: r.currency,
    status: r.status,
    providerTxnId: r.providerTxnId,
    failureReason: r.failureReason,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  };
}
function mask(value: string | null) {
  return value ? `••••${value.slice(-4)}` : null;
}

function batchDto(batch: PayoutBatch) {
  return {
    id: batch.id,
    batchNumber: batch.batchNumber,
    totalRequests: batch.totalRequests,
    totalAmount: batch.totalAmount.toString(),
    status: batch.status,
    processedBy: batch.processedBy,
    createdAt: batch.createdAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
  };
}
