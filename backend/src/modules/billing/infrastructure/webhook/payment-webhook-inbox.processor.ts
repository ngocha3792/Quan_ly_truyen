import { Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Inject } from '@nestjs/common';

import { billingConfig } from '@/config';
import {
  InboundWebhookStatus,
  PaymentOrderStatus,
  Prisma,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import {
  PostWalletTransactionCommand,
  PostWalletTransactionCommandHandler,
} from '@/modules/wallets';

import type { NormalizedPaymentEvent } from '../../application';
import {
  BillingResourceNotFoundException,
  PaymentOrderTransitionException,
} from '../../domain';

export interface PaymentWebhookProcessingSummary {
  readonly scanned: number;
  readonly processed: number;
  readonly failed: number;
  readonly skipped: number;
}

@Injectable()
export class PaymentWebhookInboxProcessor {
  private readonly logger = new Logger(PaymentWebhookInboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly postWalletTransaction: PostWalletTransactionCommandHandler,
    @Inject(billingConfig.KEY)
    private readonly config: ConfigType<typeof billingConfig>,
  ) {}

  async processBatch(
    batchSize = this.config.webhookBatchSize,
  ): Promise<PaymentWebhookProcessingSummary> {
    const now = new Date();
    await this.expireStaleOrders(now);
    await this.recoverStaleClaims(now);
    const events = await this.prisma.inboundWebhookEvent.findMany({
      where: {
        provider: `payment:${this.config.providerMode}`,
        status: {
          in: [InboundWebhookStatus.PENDING, InboundWebhookStatus.FAILED],
        },
        attempts: { lt: this.config.webhookMaxAttempts },
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: Math.min(Math.max(batchSize, 1), 500),
    });
    const summary = {
      scanned: events.length,
      processed: 0,
      failed: 0,
      skipped: 0,
    };
    for (const event of events) {
      const claimedAttempt = event.attempts + 1;
      const claim = await this.prisma.inboundWebhookEvent.updateMany({
        where: { id: event.id, status: event.status, attempts: event.attempts },
        data: {
          status: InboundWebhookStatus.PROCESSING,
          attempts: { increment: 1 },
          processingStartedAt: new Date(),
        },
      });
      if (claim.count !== 1) {
        summary.skipped++;
        continue;
      }
      try {
        await this.processEvent(toPaymentEvent(event.payload));
        const finalized = await this.prisma.inboundWebhookEvent.updateMany({
          where: {
            id: event.id,
            status: InboundWebhookStatus.PROCESSING,
            attempts: claimedAttempt,
          },
          data: {
            status: InboundWebhookStatus.PROCESSED,
            processedAt: new Date(),
            processingStartedAt: null,
            lastError: null,
          },
        });
        if (finalized.count === 1) summary.processed++;
        else summary.skipped++;
      } catch (error: unknown) {
        await this.finalizeFailure(event.id, claimedAttempt, error);
        summary.failed++;
      }
    }
    return summary;
  }

  private async processEvent(event: NormalizedPaymentEvent): Promise<void> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: event.orderId },
    });
    if (!order)
      throw new BillingResourceNotFoundException(
        'đơn thanh toán',
        event.orderId,
      );
    if (
      order.provider !== this.config.providerMode ||
      order.providerReference !== event.providerReference ||
      order.fiatAmountMinor.toString() !== event.amountMinor ||
      order.currency !== event.currency
    ) {
      throw new PaymentOrderTransitionException(
        order.status,
        'PROVIDER_MISMATCH',
      );
    }

    if (event.type === 'payment.failed') {
      if (order.status === PaymentOrderStatus.FAILED) return;
      if (
        order.status !== PaymentOrderStatus.CREATED &&
        order.status !== PaymentOrderStatus.PENDING
      ) {
        throw new PaymentOrderTransitionException(
          order.status,
          PaymentOrderStatus.FAILED,
        );
      }
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: PaymentOrderStatus.FAILED,
          failureCode: 'PROVIDER_REPORTED_FAILURE',
        },
      });
      return;
    }

    if (event.type === 'payment.succeeded') {
      if (
        order.status === PaymentOrderStatus.PAID ||
        order.status === PaymentOrderStatus.REFUNDED ||
        order.status === PaymentOrderStatus.REVERSED
      ) {
        return;
      }
      if (order.status !== PaymentOrderStatus.PENDING) {
        throw new PaymentOrderTransitionException(
          order.status,
          PaymentOrderStatus.PAID,
        );
      }
      const result = await this.postWalletTransaction.execute(
        new PostWalletTransactionCommand(
          order.userId,
          'CREDIT',
          'TOP_UP',
          'CREDIT',
          order.creditAmount,
          'PAYMENT_CLEARING',
          `payment-order:${order.id}`,
          'payment_order',
          order.id,
          {
            provider: order.provider,
            providerReference: event.providerReference,
          },
        ),
      );
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: PaymentOrderStatus.PENDING },
        data: {
          status: PaymentOrderStatus.PAID,
          walletTransactionId: result.transaction.id,
          settledAt: new Date(event.occurredAt),
          failureCode: null,
        },
      });
      return;
    }

    const targetStatus =
      event.type === 'payment.refunded'
        ? PaymentOrderStatus.REFUNDED
        : PaymentOrderStatus.REVERSED;
    if (order.status === targetStatus) return;
    if (order.status !== PaymentOrderStatus.PAID) {
      throw new PaymentOrderTransitionException(order.status, targetStatus);
    }
    const result = await this.postWalletTransaction.execute(
      new PostWalletTransactionCommand(
        order.userId,
        'CREDIT',
        event.type === 'payment.refunded' ? 'REFUND' : 'REVERSAL',
        'DEBIT',
        order.creditAmount,
        'PAYMENT_CLEARING',
        `${event.type}:${order.id}`,
        event.type === 'payment.refunded'
          ? 'payment_refund'
          : 'payment_reversal',
        order.id,
        {
          provider: order.provider,
          providerReference: event.providerReference,
        },
      ),
    );
    await this.prisma.$transaction([
      this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: targetStatus },
      }),
      this.prisma.auditLog.create({
        data: {
          action: `payment.order.${targetStatus.toLowerCase()}`,
          entityType: 'payment_order',
          entityId: order.id,
          newValues: {
            walletTransactionId: result.transaction.id,
            eventId: event.eventId,
          },
        },
      }),
    ]);
  }

  private async expireStaleOrders(now: Date): Promise<void> {
    await this.prisma.paymentOrder.updateMany({
      where: {
        status: {
          in: [PaymentOrderStatus.CREATED, PaymentOrderStatus.PENDING],
        },
        expiresAt: { lt: now },
      },
      data: {
        status: PaymentOrderStatus.EXPIRED,
        failureCode: 'ORDER_EXPIRED',
      },
    });
  }

  private async recoverStaleClaims(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - 5 * 60_000);
    await this.prisma.inboundWebhookEvent.updateMany({
      where: {
        provider: `payment:${this.config.providerMode}`,
        status: InboundWebhookStatus.PROCESSING,
        processingStartedAt: { lt: staleBefore },
        attempts: { lt: this.config.webhookMaxAttempts },
      },
      data: {
        status: InboundWebhookStatus.FAILED,
        processingStartedAt: null,
        nextAttemptAt: now,
        lastError: 'Stale payment webhook claim recovered',
      },
    });
  }

  private async finalizeFailure(
    id: string,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const deadLetter = attempts >= this.config.webhookMaxAttempts;
    const message =
      error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error';
    await this.prisma.inboundWebhookEvent.updateMany({
      where: { id, status: InboundWebhookStatus.PROCESSING, attempts },
      data: {
        status: deadLetter
          ? InboundWebhookStatus.DEAD_LETTER
          : InboundWebhookStatus.FAILED,
        processingStartedAt: null,
        lastError: message,
        nextAttemptAt: new Date(
          Date.now() +
            this.config.webhookRetryBaseMs * 2 ** Math.max(attempts - 1, 0),
        ),
      },
    });
    this.logger.warn({
      event: 'payment.webhook.failed',
      webhookId: id,
      attempts,
      deadLetter,
    });
  }
}

function toPaymentEvent(payload: Prisma.JsonValue): NormalizedPaymentEvent {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Normalized payment event payload is invalid');
  }
  return payload as unknown as NormalizedPaymentEvent;
}
