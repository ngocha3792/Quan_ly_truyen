import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { billingConfig } from '@/config';

import type {
  NormalizedPaymentEvent,
  PaymentCheckoutInput,
  PaymentCheckoutResult,
  PaymentProviderPort,
  PaymentWebhookInput,
} from '../../application';
import {
  InvalidBillingInputException,
  PAYMENT_EVENT_TYPES,
  PaymentProviderUnavailableException,
} from '../../domain';

@Injectable()
export class ConfiguredPaymentProviderAdapter implements PaymentProviderPort {
  constructor(
    @Inject(billingConfig.KEY)
    private readonly config: ConfigType<typeof billingConfig>,
  ) {}

  get code(): string {
    return this.config.providerMode;
  }

  createCheckout(input: PaymentCheckoutInput): Promise<PaymentCheckoutResult> {
    this.assertSandboxConfigured();
    const providerReference = `sandbox-${input.orderId}`;
    const url = new URL(this.config.checkoutBaseUrl!);
    url.searchParams.set('orderId', input.orderId);
    url.searchParams.set('providerReference', providerReference);
    url.searchParams.set('amountMinor', input.amountMinor.toString());
    url.searchParams.set('currency', input.currency);
    url.searchParams.set('expiresAt', input.expiresAt.toISOString());
    url.searchParams.set('returnUrl', this.config.returnUrl!);
    url.searchParams.set(
      'signature',
      this.sign(
        [
          input.orderId,
          providerReference,
          input.amountMinor.toString(),
          input.currency,
          input.expiresAt.toISOString(),
        ].join('.'),
      ),
    );
    return Promise.resolve({ providerReference, checkoutUrl: url.toString() });
  }

  verifyWebhook(input: PaymentWebhookInput): NormalizedPaymentEvent {
    this.assertSandboxConfigured();
    if (input.providerCode !== this.code) {
      throw new InvalidBillingInputException(
        'Payment provider không khớp',
        'providerCode',
      );
    }
    const timestamp = Number(input.timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      Math.abs(nowSeconds - timestamp) > this.config.webhookSignatureTtlSeconds
    ) {
      throw new InvalidBillingInputException(
        'Timestamp webhook không hợp lệ hoặc đã hết hạn',
      );
    }
    const expected = this.sign(
      `${input.timestamp}.${input.rawBody.toString('utf8')}`,
    );
    if (!safeEqual(expected, input.signature)) {
      throw new InvalidBillingInputException(
        'Chữ ký webhook thanh toán không hợp lệ',
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(input.rawBody.toString('utf8'));
    } catch (error: unknown) {
      throw new InvalidBillingInputException(
        error instanceof Error
          ? 'Payload webhook không phải JSON hợp lệ'
          : 'Payload webhook lỗi',
      );
    }
    return normalizeEvent(payload);
  }

  private assertSandboxConfigured(): void {
    if (
      this.config.providerMode !== 'hmac-sandbox' ||
      !this.config.checkoutBaseUrl ||
      !this.config.returnUrl ||
      !this.config.webhookSecret
    ) {
      throw new PaymentProviderUnavailableException();
    }
  }

  private sign(value: string): string {
    return createHmac('sha256', this.config.webhookSecret!)
      .update(value)
      .digest('hex');
  }
}

function normalizeEvent(value: unknown): NormalizedPaymentEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidBillingInputException(
      'Payload webhook phải là JSON object',
    );
  }
  const record = value as Record<string, unknown>;
  const eventId = requiredString(record.eventId, 'eventId', 255);
  const type = requiredString(record.type, 'type', 120);
  if (
    !PAYMENT_EVENT_TYPES.includes(type as (typeof PAYMENT_EVENT_TYPES)[number])
  ) {
    throw new InvalidBillingInputException(
      'Loại webhook thanh toán không được hỗ trợ',
      'type',
    );
  }
  const amountMinor = requiredIntegerString(record.amountMinor, 'amountMinor');
  const currency = requiredString(record.currency, 'currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/u.test(currency)) {
    throw new InvalidBillingInputException(
      'Mã tiền tệ không hợp lệ',
      'currency',
    );
  }
  const occurredAt = requiredString(record.occurredAt, 'occurredAt', 50);
  if (Number.isNaN(Date.parse(occurredAt))) {
    throw new InvalidBillingInputException(
      'Thời gian sự kiện không hợp lệ',
      'occurredAt',
    );
  }
  return {
    eventId,
    type: type as NormalizedPaymentEvent['type'],
    orderId: requiredString(record.orderId, 'orderId', 36),
    providerReference: requiredString(
      record.providerReference,
      'providerReference',
      160,
    ),
    amountMinor,
    currency,
    occurredAt: new Date(occurredAt).toISOString(),
  };
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new InvalidBillingInputException(`${field} không hợp lệ`, field);
  }
  return value.trim();
}

function requiredIntegerString(value: unknown, field: string): string {
  const normalized =
    typeof value === 'number'
      ? String(value)
      : requiredString(value, field, 30);
  if (!/^[1-9]\d*$/u.test(normalized)) {
    throw new InvalidBillingInputException(
      `${field} phải là số nguyên dương`,
      field,
    );
  }
  return normalized;
}

function safeEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
