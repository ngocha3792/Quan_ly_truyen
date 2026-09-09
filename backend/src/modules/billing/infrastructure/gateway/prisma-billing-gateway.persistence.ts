import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { IdempotencyConflictException } from '@/common/exceptions';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

import type {
  BillingGatewayPersistencePort,
  BillingRefundRecord,
  ReserveBillingRefundInput,
} from '../../application/ports/billing-gateway.persistence.port';
import type {
  PaymentQueryResult,
  PaymentRefundResult,
} from '../../application/ports/payment-provider.port';
import {
  BillingResourceNotFoundException,
  PaymentOrderTransitionException,
} from '../../domain';
import {
  BillingGatewayReader,
  toBillingRefund as toRefund,
} from './billing-gateway-reader';
import {
  lockPaymentSettlement,
  postRefundLedger,
} from './billing-refund-ledger';

@Injectable()
export class PrismaBillingGatewayPersistence implements BillingGatewayPersistencePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: BillingGatewayReader,
  ) {}

  getOrder(orderId: string) {
    return this.reader.getOrder(orderId);
  }

  listRefunds(orderId: string) {
    return this.reader.listRefunds(orderId);
  }

  async reserveRefund(input: ReserveBillingRefundInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('billing-refund-key:' || ${input.idempotencyKey}))`,
      );
      await lockPaymentSettlement(tx, input.orderId);
      const replay = await tx.billingRefund.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (replay) {
        if (
          replay.orderId !== input.orderId ||
          replay.reason !== input.reason ||
          replay.actorId !== input.actorId
        ) {
          throw new IdempotencyConflictException({ key: input.idempotencyKey });
        }
        return { refund: toRefund(replay), replayed: true };
      }
      const active = await tx.billingRefund.findFirst({
        where: { orderId: input.orderId, status: { not: 'FAILED' } },
      });
      if (active)
        throw new PaymentOrderTransitionException(
          active.status,
          'REFUND_ALREADY_EXISTS',
        );
      const order = await tx.paymentOrder.findUnique({
        where: { id: input.orderId },
      });
      if (!order)
        throw new BillingResourceNotFoundException(
          'đơn thanh toán',
          input.orderId,
        );
      if (order.status !== 'PAID')
        throw new PaymentOrderTransitionException(order.status, 'REFUND');
      const refund = await tx.billingRefund.create({
        data: {
          id: randomUUID(),
          orderId: order.id,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          reason: input.reason,
          amountMinor: order.fiatAmountMinor,
          creditAmount: order.creditAmount,
          currency: order.currency,
        },
      });
      await postRefundLedger(tx, {
        userId: order.userId,
        orderId: order.id,
        refundId: refund.id,
        amount: order.creditAmount,
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'payment.refund.requested',
          entityType: 'billing_refund',
          entityId: refund.id,
          newValues: {
            orderId: order.id,
            reason: input.reason,
            amountMinor: order.fiatAmountMinor.toString(),
            creditAmount: order.creditAmount.toString(),
          },
        },
      });
      return { refund: toRefund(refund), replayed: false };
    });
  }

  async finishRefund(
    refundId: string,
    result: PaymentRefundResult,
  ): Promise<BillingRefundRecord> {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.billingRefund.findUnique({
        where: { id: refundId },
      });
      if (!initial)
        throw new BillingResourceNotFoundException('hoàn tiền', refundId);
      await lockPaymentSettlement(tx, initial.orderId);
      const refund = await tx.billingRefund.findUniqueOrThrow({
        where: { id: refundId },
      });
      if (['COMPLETED', 'FAILED'].includes(refund.status))
        return toRefund(refund);
      const order = await tx.paymentOrder.findUniqueOrThrow({
        where: { id: refund.orderId },
      });
      const completed = result.status === 'SUCCEEDED';
      if (result.status === 'FAILED') {
        await postRefundLedger(tx, {
          userId: order.userId,
          orderId: order.id,
          refundId,
          amount: refund.creditAmount,
          release: true,
        });
      }
      if (completed)
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: { status: 'REFUNDED' },
        });
      const updated = await tx.billingRefund.update({
        where: { id: refundId },
        data: {
          status: completed ? 'COMPLETED' : result.status,
          providerRefundId: result.providerRefundId,
          responseCode: result.responseCode,
          completedAt: ['SUCCEEDED', 'FAILED'].includes(result.status)
            ? new Date()
            : null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: refund.actorId,
          action: `payment.refund.${updated.status.toLowerCase()}`,
          entityType: 'billing_refund',
          entityId: refundId,
          newValues: {
            orderId: order.id,
            status: updated.status,
            responseCode: result.responseCode,
          },
        },
      });
      return toRefund(updated);
    });
  }

  async applyVerifiedRefund(
    orderId: string,
    providerRefundId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockPaymentSettlement(tx, orderId);
      const order = await tx.paymentOrder.findUniqueOrThrow({
        where: { id: orderId },
      });
      if (order.status === 'REFUNDED') return;
      const neverCredited =
        order.walletTransactionId === null &&
        ['CREATED', 'PENDING', 'FAILED', 'EXPIRED'].includes(order.status);
      if (order.status !== 'PAID' && !neverCredited)
        throw new PaymentOrderTransitionException(order.status, 'REFUNDED');
      const reservation = await tx.billingRefund.findFirst({
        where: { orderId, status: { in: ['PENDING', 'UNKNOWN'] } },
      });
      if (reservation) {
        await tx.billingRefund.update({
          where: { id: reservation.id },
          data: {
            status: 'COMPLETED',
            providerRefundId,
            responseCode: '00',
            completedAt: new Date(),
          },
        });
      } else if (!neverCredited) {
        await postRefundLedger(tx, {
          userId: order.userId,
          orderId,
          refundId: orderId,
          amount: order.creditAmount,
        });
      }
      await tx.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'REFUNDED' },
      });
      await tx.auditLog.create({
        data: {
          action: 'payment.refund.verified',
          entityType: 'payment_order',
          entityId: orderId,
          newValues: { providerRefundId, refundId: reservation?.id ?? null },
        },
      });
    });
  }

  recordReconciliation(
    actorId: string,
    orderId: string,
    result: PaymentQueryResult,
  ) {
    return this.reader.recordReconciliation(actorId, orderId, result);
  }
}
