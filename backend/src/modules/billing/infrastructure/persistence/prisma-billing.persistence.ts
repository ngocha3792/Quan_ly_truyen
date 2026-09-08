import { Injectable } from '@nestjs/common';

import {
  AccountStatus,
  InboundWebhookStatus,
  PaymentOrderStatus,
  PaymentProviderKind,
  Prisma,
} from '@/generated/prisma/client';
import {
  AppException,
  IdempotencyConflictException,
} from '@/common/exceptions';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import { TransactionalReceiptService } from '@/modules/notifications';

import type {
  BillingPersistencePort,
  AdminPaymentOrderPageRecord,
  CreditPackageRecord,
  NormalizedPaymentEvent,
  PaymentOrderPageRecord,
  PaymentOrderRecord,
  PaymentProviderConnectionRecord,
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
  providerConnectionId: true,
  providerReference: true,
  creditAmount: true,
  fiatAmountMinor: true,
  currency: true,
  status: true,
  checkoutUrl: true,
  walletTransactionId: true,
  failureCode: true,
  metadata: true,
  reviewRequestedAt: true,
  reviewedAt: true,
  reviewedById: true,
  reviewReason: true,
  expiresAt: true,
  settledAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentOrderSelect;

const CONNECTION_SELECT = {
  id: true,
  code: true,
  kind: true,
  displayName: true,
  description: true,
  config: true,
  currency: true,
  enabled: true,
  sortOrder: true,
  orderTtlMinutes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentProviderConnectionSelect;

type PackageRow = Prisma.CreditPackageGetPayload<{
  select: typeof PACKAGE_SELECT;
}>;
type OrderRow = Prisma.PaymentOrderGetPayload<{ select: typeof ORDER_SELECT }>;
type ConnectionRow = Prisma.PaymentProviderConnectionGetPayload<{
  select: typeof CONNECTION_SELECT;
}>;

const ADMIN_ORDER_SELECT = {
  ...ORDER_SELECT,
  user: { select: { email: true, displayName: true } },
  creditPackage: { select: { label: true } },
} satisfies Prisma.PaymentOrderSelect;

type AdminOrderRow = Prisma.PaymentOrderGetPayload<{
  select: typeof ADMIN_ORDER_SELECT;
}>;

interface PaymentReconciliationRow {
  paidOrders: bigint;
  paidOrdersWithoutLedger: bigint;
  orphanTopUpTransactions: bigint;
  pendingExpiredOrders: bigint;
  awaitingReviewOrders: bigint;
  awaitingReviewOlderThan24h: bigint;
}

@Injectable()
export class PrismaBillingPersistence implements BillingPersistencePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: TransactionalReceiptService,
  ) {}

  async resolveConnection(
    id?: string,
  ): Promise<PaymentProviderConnectionRecord> {
    const row = await this.prisma.paymentProviderConnection.findFirst({
      where: { ...(id ? { id } : {}), enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: CONNECTION_SELECT,
    });
    if (!row)
      throw new BillingResourceNotFoundException(
        'phương thức thanh toán đang hoạt động',
        id,
      );
    return toConnectionRecord(row);
  }

  async getConnectionByCode(
    code: string,
  ): Promise<PaymentProviderConnectionRecord> {
    const row = await this.prisma.paymentProviderConnection.findFirst({
      where: { code },
      select: CONNECTION_SELECT,
    });
    if (!row)
      throw new BillingResourceNotFoundException('kết nối thanh toán', code);
    return toConnectionRecord(row);
  }

  async listConnections(
    enabledOnly: boolean,
  ): Promise<readonly PaymentProviderConnectionRecord[]> {
    const rows = await this.prisma.paymentProviderConnection.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: CONNECTION_SELECT,
    });
    return rows.map(toConnectionRecord);
  }

  async createConnection(
    input: Parameters<BillingPersistencePort['createConnection']>[0],
  ): Promise<PaymentProviderConnectionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.paymentProviderConnection.create({
        data: {
          code: input.code,
          kind: PaymentProviderKind[input.kind],
          displayName: input.displayName,
          description: input.description,
          config: input.config as Prisma.InputJsonObject,
          currency: input.currency,
          enabled: input.enabled,
          sortOrder: input.sortOrder,
          orderTtlMinutes: input.orderTtlMinutes,
          createdById: input.actorId,
          updatedById: input.actorId,
        },
        select: CONNECTION_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'payment.provider.created',
          entityType: 'payment_provider_connection',
          entityId: row.id,
          newValues: serializeConnection(row),
        },
      });
      return toConnectionRecord(row);
    });
  }

  async updateConnection(
    input: Parameters<BillingPersistencePort['updateConnection']>[0],
  ): Promise<PaymentProviderConnectionRecord> {
    const current = await this.prisma.paymentProviderConnection.findUnique({
      where: { id: input.id },
      select: CONNECTION_SELECT,
    });
    if (!current)
      throw new BillingResourceNotFoundException(
        'kết nối thanh toán',
        input.id,
      );
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.paymentProviderConnection.update({
        where: { id: input.id },
        data: {
          displayName: input.displayName,
          description: input.description,
          config: input.config as Prisma.InputJsonObject | undefined,
          currency: input.currency,
          enabled: input.enabled,
          sortOrder: input.sortOrder,
          orderTtlMinutes: input.orderTtlMinutes,
          updatedById: input.actorId,
        },
        select: CONNECTION_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'payment.provider.updated',
          entityType: 'payment_provider_connection',
          entityId: row.id,
          oldValues: serializeConnection(current),
          newValues: serializeConnection(row),
        },
      });
      return toConnectionRecord(row);
    });
  }

  async deleteConnection(actorId: string, id: string): Promise<void> {
    const activeOrders = await this.prisma.paymentOrder.count({
      where: {
        providerConnectionId: id,
        status: {
          in: [
            PaymentOrderStatus.CREATED,
            PaymentOrderStatus.PENDING,
            PaymentOrderStatus.AWAITING_REVIEW,
          ],
        },
      },
    });
    if (activeOrders > 0)
      throw new InvalidBillingInputException(
        'Không thể xoá kết nối đang có đơn chưa kết thúc',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentProviderConnection.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'payment.provider.deleted',
          entityType: 'payment_provider_connection',
          entityId: id,
        },
      });
    });
  }

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
              in: [
                PaymentOrderStatus.CREATED,
                PaymentOrderStatus.PENDING,
                PaymentOrderStatus.AWAITING_REVIEW,
              ],
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
            providerConnectionId: input.providerConnectionId,
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

  async attachInstructions(input: {
    orderId: string;
    providerReference: string;
    instructions: Readonly<Record<string, unknown>>;
  }): Promise<PaymentOrderRecord> {
    const updated = await this.prisma.paymentOrder.update({
      where: { id: input.orderId },
      data: {
        providerReference: input.providerReference,
        checkoutUrl: null,
        metadata: {
          instructions: input.instructions,
        } as Prisma.InputJsonObject,
        status: PaymentOrderStatus.PENDING,
        failureCode: null,
      },
      select: ORDER_SELECT,
    });
    return toOrderRecord(updated);
  }

  async markOrderTransferred(input: {
    userId: string;
    orderId: string;
    referenceCode?: string;
    note?: string;
  }): Promise<PaymentOrderRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentOrder.findFirst({
        where: { id: input.orderId, userId: input.userId },
        select: ORDER_SELECT,
      });
      if (!current)
        throw new BillingResourceNotFoundException(
          'đơn nạp Credit',
          input.orderId,
        );
      if (current.status === PaymentOrderStatus.AWAITING_REVIEW)
        return toOrderRecord(current);
      const metadata = jsonObject(current.metadata);
      const claimedAt = new Date();
      const updated = await tx.paymentOrder.updateMany({
        where: {
          id: input.orderId,
          userId: input.userId,
          status: PaymentOrderStatus.PENDING,
        },
        data: {
          status: PaymentOrderStatus.AWAITING_REVIEW,
          reviewRequestedAt: claimedAt,
          metadata: {
            ...metadata,
            userClaim: {
              ...(input.referenceCode
                ? { referenceCode: input.referenceCode }
                : {}),
              ...(input.note ? { note: input.note } : {}),
              claimedAt: claimedAt.toISOString(),
            },
          },
        },
      });
      if (updated.count !== 1)
        throw new InvalidBillingInputException(
          'Đơn không còn ở trạng thái chờ chuyển khoản',
        );
      const row = await tx.paymentOrder.findUniqueOrThrow({
        where: { id: input.orderId },
        select: ORDER_SELECT,
      });
      return toOrderRecord(row);
    });
  }

  async rejectManualOrder(
    input: Parameters<BillingPersistencePort['rejectManualOrder']>[0],
  ): Promise<PaymentOrderRecord> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.paymentOrder.updateMany({
        where: {
          id: input.orderId,
          status: PaymentOrderStatus.AWAITING_REVIEW,
        },
        data: {
          status: PaymentOrderStatus.FAILED,
          failureCode: 'MANUAL_REVIEW_REJECTED',
          reviewedAt: now,
          reviewedById: input.actorId,
          reviewReason: input.reason,
        },
      });
      if (updated.count !== 1)
        throw new InvalidBillingInputException('Đơn không còn chờ xác nhận');
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'payment.order.rejected.manual',
          entityType: 'payment_order',
          entityId: input.orderId,
          newValues: { reason: input.reason },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
        },
      });
      const order = await tx.paymentOrder.findUniqueOrThrow({
        where: { id: input.orderId },
        select: ORDER_SELECT,
      });
      await this.receipts.enqueue(tx, {
        userId: order.userId,
        dedupeKey: `payment-order-rejected:${order.id}`,
        type: 'payment_rejected',
        title: 'Yêu cầu nạp Credit bị từ chối',
        body: `Yêu cầu chuyển khoản chưa được chấp nhận: ${input.reason}`,
        tag: 'Từ chối nạp Credit',
        transactionId: order.id,
        amountCredits: order.creditAmount,
        data: { paymentOrderId: order.id, provider: order.provider },
      });
      return toOrderRecord(order);
    });
  }

  async getOrderForReview(orderId: string): Promise<PaymentOrderRecord> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: ORDER_SELECT,
    });
    if (!order)
      throw new BillingResourceNotFoundException('đơn nạp Credit', orderId);
    return toOrderRecord(order);
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

  async listAdminOrders(input: {
    page: number;
    pageSize: number;
    status?: import('../../domain').PaymentOrderStatusName;
    provider?: string;
    query?: string;
    from?: Date;
    to?: Date;
  }): Promise<AdminPaymentOrderPageRecord> {
    const query = input.query?.trim();
    const where = {
      ...(input.status ? { status: PaymentOrderStatus[input.status] } : {}),
      ...(input.provider?.trim()
        ? {
            provider: {
              equals: input.provider.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(input.from || input.to
        ? {
            createdAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              ...(isUuid(query) ? [{ id: query }] : []),
              {
                providerReference: {
                  contains: query,
                  mode: 'insensitive' as const,
                },
              },
              {
                user: {
                  email: { contains: query, mode: 'insensitive' as const },
                },
              },
              {
                user: {
                  displayName: {
                    contains: query,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    } satisfies Prisma.PaymentOrderWhereInput;
    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: ADMIN_ORDER_SELECT,
      }),
      this.prisma.paymentOrder.count({ where }),
    ]);
    return {
      items: items.map(toAdminOrderRecord),
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
        )::bigint AS "pendingExpiredOrders",
        COUNT(*) FILTER (WHERE po.status = 'awaiting_review')::bigint AS "awaitingReviewOrders",
        COUNT(*) FILTER (
          WHERE po.status = 'awaiting_review'
            AND po.review_requested_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
        )::bigint AS "awaitingReviewOlderThan24h"
      FROM payment_orders po
      LEFT JOIN wallet_ledger_transactions wt ON wt.id = po.wallet_transaction_id
    `);
    return {
      paidOrders: Number(row?.paidOrders ?? 0n),
      paidOrdersWithoutLedger: Number(row?.paidOrdersWithoutLedger ?? 0n),
      orphanTopUpTransactions: Number(row?.orphanTopUpTransactions ?? 0n),
      pendingExpiredOrders: Number(row?.pendingExpiredOrders ?? 0n),
      awaitingReviewOrders: Number(row?.awaitingReviewOrders ?? 0n),
      awaitingReviewOlderThan24h: Number(row?.awaitingReviewOlderThan24h ?? 0n),
    };
  }
}

function toPackageRecord(row: PackageRow): CreditPackageRecord {
  return row;
}

function toOrderRecord(row: OrderRow): PaymentOrderRecord {
  return row;
}

function toAdminOrderRecord(row: AdminOrderRow) {
  return {
    ...toOrderRecord(row),
    userEmail: row.user.email,
    userDisplayName: row.user.displayName,
    packageLabel: row.creditPackage.label,
  };
}

function toConnectionRecord(
  row: ConnectionRow,
): PaymentProviderConnectionRecord {
  return {
    ...row,
    kind: row.kind,
    config: jsonObject(row.config),
  };
}

function jsonObject(
  value: Prisma.JsonValue | null,
): Readonly<Record<string, unknown>> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
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

function serializeConnection(row: ConnectionRow): Prisma.InputJsonObject {
  return {
    code: row.code,
    kind: row.kind,
    displayName: row.displayName,
    description: row.description,
    currency: row.currency,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    orderTtlMinutes: row.orderTtlMinutes,
    config: jsonObject(row.config) as Prisma.InputJsonObject,
  };
}
