import { Injectable } from '@nestjs/common';

import {
  AccountStatus,
  InboundWebhookStatus,
  PaymentOrderStatus,
  Prisma,
} from '@/generated/prisma/client';
import {
  AppException,
  IdempotencyConflictException,
} from '@/common/exceptions';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  BillingPersistencePort,
  CreditPackageRecord,
  NormalizedPaymentEvent,
  PaymentOrderPageRecord,
  PaymentOrderRecord,
  PaymentReconciliationRecord,
  PreparePaymentOrderInput,
  PreparedPaymentOrder,
} from '../../application';
import {
  BillingResourceNotFoundException,
  InvalidBillingInputException,
} from '../../domain';

const PACKAGE_SELECT = {
  id: true,
  code: true,
  label: true,
  creditAmount: true,
  fiatAmountMinor: true,
  currency: true,
  isActive: true,
  sortOrder: true,
  updatedAt: true,
} satisfies Prisma.CreditPackageSelect;

const ORDER_SELECT = {
  id: true,
  userId: true,
  packageId: true,
  provider: true,
  providerReference: true,
  creditAmount: true,
  fiatAmountMinor: true,
  currency: true,
  status: true,
  checkoutUrl: true,
  walletTransactionId: true,
  failureCode: true,
  expiresAt: true,
  settledAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentOrderSelect;

type PackageRow = Prisma.CreditPackageGetPayload<{
  select: typeof PACKAGE_SELECT;
}>;
type OrderRow = Prisma.PaymentOrderGetPayload<{ select: typeof ORDER_SELECT }>;

interface PaymentReconciliationRow {
  paidOrders: bigint;
  paidOrdersWithoutLedger: bigint;
  orphanTopUpTransactions: bigint;
  pendingExpiredOrders: bigint;
}

@Injectable()
export class PrismaBillingPersistence implements BillingPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async receiveWebhookEvent(input: {
    provider: string;
    event: NormalizedPaymentEvent;
    payloadHash: string;
  }): Promise<{ readonly duplicate: boolean }> {
    const provider = `payment:${input.provider}`;
    try {
      await this.prisma.inboundWebhookEvent.create({
        data: {
          provider,
          eventKey: input.event.eventId,
          payloadHash: input.payloadHash,
          eventType: input.event.type,
          status: InboundWebhookStatus.PENDING,
          payload: input.event as unknown as Prisma.InputJsonObject,
        },
      });
      return { duplicate: false };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.inboundWebhookEvent.findUnique({
          where: {
            provider_eventKey: { provider, eventKey: input.event.eventId },
          },
          select: { payloadHash: true },
        });
        if (!existing || existing.payloadHash !== input.payloadHash) {
          throw new InvalidBillingInputException(
            'Provider event id đã tồn tại với payload khác',
            'eventId',
          );
        }
        return { duplicate: true };
      }
      throw mapPrismaError(error, {
        operation: 'billing-receive-payment-webhook',
        resource: 'Webhook thanh toán',
      });
    }
  }

  async listPackages(
    activeOnly: boolean,
  ): Promise<readonly CreditPackageRecord[]> {
    const rows = await this.prisma.creditPackage.findMany({
      ...(activeOnly ? { where: { isActive: true } } : {}),
      orderBy: [{ sortOrder: 'asc' }, { fiatAmountMinor: 'asc' }],
      select: PACKAGE_SELECT,
    });
    return rows.map(toPackageRecord);
  }

  async updatePackage(input: {
    actorId: string;
    packageId: string;
    label?: string;
    creditAmount?: bigint;
    fiatAmountMinor?: bigint;
    currency?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<CreditPackageRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.creditPackage.findUnique({
        where: { id: input.packageId },
        select: PACKAGE_SELECT,
      });
      if (!current)
        throw new BillingResourceNotFoundException(
          'gói Credit',
          input.packageId,
        );
      const updated = await tx.creditPackage.update({
        where: { id: input.packageId },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.creditAmount !== undefined
            ? { creditAmount: input.creditAmount }
            : {}),
          ...(input.fiatAmountMinor !== undefined
            ? { fiatAmountMinor: input.fiatAmountMinor }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
        },
        select: PACKAGE_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'billing.credit-package.updated',
          entityType: 'credit_package',
          entityId: input.packageId,
          oldValues: serializePackage(current),
          newValues: serializePackage(updated),
        },
      });
      return toPackageRecord(updated);
    });
  }

  async prepareOrder(
    input: PreparePaymentOrderInput,
  ): Promise<PreparedPaymentOrder> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext('payment-order-user:' || ${input.userId}))
        `);
        await tx.$executeRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext('payment-order:' || ${input.idempotencyKey}))
        `);
        const existing = await tx.paymentOrder.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { ...ORDER_SELECT, requestHash: true },
        });
        if (existing) {
          if (existing.requestHash !== input.requestHash) {
            throw new IdempotencyConflictException({
              key: input.idempotencyKey,
              existingRequestHash: existing.requestHash,
              currentRequestHash: input.requestHash,
            });
          }
          return { order: toOrderRecord(existing), replayed: true };
        }

        const [user, creditPackage] = await Promise.all([
          tx.user.findFirst({
            where: {
              id: input.userId,
              status: AccountStatus.ACTIVE,
              deletedAt: null,
            },
            select: { id: true },
          }),
          tx.creditPackage.findFirst({
            where: { id: input.packageId, isActive: true },
            select: PACKAGE_SELECT,
          }),
        ]);
        if (!user)
          throw new BillingResourceNotFoundException('tài khoản', input.userId);
        if (!creditPackage) {
          throw new BillingResourceNotFoundException(
            'gói Credit đang hoạt động',
            input.packageId,
          );
        }
        const pendingOrders = await tx.paymentOrder.count({
          where: {
            userId: input.userId,
            status: {
              in: [PaymentOrderStatus.CREATED, PaymentOrderStatus.PENDING],
            },
            expiresAt: { gt: new Date() },
          },
        });
        if (pendingOrders >= input.pendingOrderLimit) {
          throw new InvalidBillingInputException(
            `Bạn chỉ có thể có tối đa ${input.pendingOrderLimit} đơn nạp đang chờ`,
          );
        }
        const order = await tx.paymentOrder.create({
          data: {
            userId: input.userId,
            packageId: creditPackage.id,
            provider: input.provider,
            creditAmount: creditPackage.creditAmount,
            fiatAmountMinor: creditPackage.fiatAmountMinor,
            currency: creditPackage.currency,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            expiresAt: new Date(Date.now() + input.ttlMinutes * 60_000),
          },
          select: ORDER_SELECT,
        });
        return { order: toOrderRecord(order), replayed: false };
      });
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw mapPrismaError(error, {
        operation: 'billing-prepare-payment-order',
        resource: 'Đơn nạp Credit',
      });
    }
  }

  async attachCheckout(input: {
    orderId: string;
    providerReference: string;
    checkoutUrl: string;
  }): Promise<PaymentOrderRecord> {
    const updated = await this.prisma.paymentOrder.update({
      where: { id: input.orderId },
      data: {
        providerReference: input.providerReference,
        checkoutUrl: input.checkoutUrl,
        status: PaymentOrderStatus.PENDING,
        failureCode: null,
      },
      select: ORDER_SELECT,
    });
    return toOrderRecord(updated);
  }

  async markCheckoutFailed(
    orderId: string,
    failureCode: string,
  ): Promise<void> {
    await this.prisma.paymentOrder.updateMany({
      where: { id: orderId, status: PaymentOrderStatus.CREATED },
      data: { status: PaymentOrderStatus.FAILED, failureCode },
    });
  }

  async getOwnOrder(
    userId: string,
    orderId: string,
  ): Promise<PaymentOrderRecord> {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { id: orderId, userId },
      select: ORDER_SELECT,
    });
    if (!order)
      throw new BillingResourceNotFoundException('đơn nạp Credit', orderId);
    return toOrderRecord(order);
  }

  async listOwnOrders(input: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<PaymentOrderPageRecord> {
    const where = {
      userId: input.userId,
    } satisfies Prisma.PaymentOrderWhereInput;
    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: ORDER_SELECT,
      }),
      this.prisma.paymentOrder.count({ where }),
    ]);
    return {
      items: items.map(toOrderRecord),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async reconcile(): Promise<PaymentReconciliationRecord> {
    const [row] = await this.prisma.$queryRaw<
      PaymentReconciliationRow[]
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE po.status = 'paid')::bigint AS "paidOrders",
        COUNT(*) FILTER (
          WHERE po.status = 'paid' AND (
            po.wallet_transaction_id IS NULL OR wt.id IS NULL OR wt.type <> 'top_up'
          )
        )::bigint AS "paidOrdersWithoutLedger",
        (
          SELECT COUNT(*)::bigint
          FROM wallet_ledger_transactions orphan
          LEFT JOIN payment_orders linked ON linked.wallet_transaction_id = orphan.id
          WHERE orphan.type = 'top_up'
            AND orphan.reference_type = 'payment_order'
            AND linked.id IS NULL
        ) AS "orphanTopUpTransactions",
        COUNT(*) FILTER (
          WHERE po.status IN ('created', 'pending') AND po.expires_at < CURRENT_TIMESTAMP
        )::bigint AS "pendingExpiredOrders"
      FROM payment_orders po
      LEFT JOIN wallet_ledger_transactions wt ON wt.id = po.wallet_transaction_id
    `);
    return {
      paidOrders: Number(row?.paidOrders ?? 0n),
      paidOrdersWithoutLedger: Number(row?.paidOrdersWithoutLedger ?? 0n),
      orphanTopUpTransactions: Number(row?.orphanTopUpTransactions ?? 0n),
      pendingExpiredOrders: Number(row?.pendingExpiredOrders ?? 0n),
    };
  }
}

function toPackageRecord(row: PackageRow): CreditPackageRecord {
  return row;
}

function toOrderRecord(row: OrderRow): PaymentOrderRecord {
  return row;
}

function serializePackage(row: PackageRow): Prisma.InputJsonObject {
  return {
    code: row.code,
    label: row.label,
    creditAmount: row.creditAmount.toString(),
    fiatAmountMinor: row.fiatAmountMinor.toString(),
    currency: row.currency,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}
