import { isIP } from 'node:net';

import { Injectable } from '@nestjs/common';

import type {
  NormalizedPaymentEvent,
  PaymentCheckoutInput,
  PaymentCheckoutResult,
  PaymentProviderAdapter,
  PaymentProviderConnectionDescriptor,
  PaymentQueryInput,
  PaymentQueryResult,
  PaymentRefundInput,
  PaymentRefundResult,
  PaymentWebhookInput,
} from '../../application';
import {
  InvalidBillingInputException,
  PaymentProviderUnavailableException,
} from '../../domain';
import {
  readyVnpayConnection,
  validateVnpayConfig,
  VNPAY_ENDPOINTS,
} from './vnpay-config';
import { VnpayOperationsClient } from './vnpay-operations.client';
import {
  assertVnpayHash,
  readVnpayFields,
  vnpayAmount,
  vnpayDate,
  vnpayEvent,
  vnpayHash,
  vnpayQuery,
  vnpayReference,
} from './vnpay-protocol';

@Injectable()
export class VnpayPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly kind = 'VNPAY' as const;
  readonly supportsWebhook = true;
  readonly requiresManualReview = false;

  constructor(private readonly operations: VnpayOperationsClient) {}

  validateConfig(config: unknown): Readonly<Record<string, unknown>> {
    return validateVnpayConfig(config ?? {});
  }

  assertReady(connection: PaymentProviderConnectionDescriptor): void {
    readyVnpayConnection(connection);
  }

  createCheckout(input: PaymentCheckoutInput): Promise<PaymentCheckoutResult> {
    if (
      process.env.NODE_ENV === 'production' &&
      input.connection.config.environment !== 'PRODUCTION'
    )
      throw new PaymentProviderUnavailableException(
        'Sandbox không được cộng Credit trong production',
      );
    const { config, hashSecret } = readyVnpayConnection(input.connection);
    if (!input.createdAt || !input.ipAddress || !isIP(input.ipAddress)) {
      throw new InvalidBillingInputException(
        'Thiếu thời gian tạo đơn hoặc IP khách hàng cho VNPAY',
      );
    }
    if (input.expiresAt <= input.createdAt || input.expiresAt <= new Date()) {
      throw new InvalidBillingInputException('Đơn VNPAY đã hết hạn');
    }
    const providerReference = vnpayReference(input.orderId);
    const returnUrl = new URL(config.returnUrl);
    returnUrl.searchParams.set('orderId', input.orderId);
    if (returnUrl.toString().length > 255)
      throw new InvalidBillingInputException('URL quay lại VNPAY quá dài');
    const params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.tmnCode,
      vnp_Amount: vnpayAmount(input.amountMinor, input.currency),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: providerReference,
      vnp_OrderInfo: `Nap Credit ${providerReference}`,
      vnp_OrderType: 'other',
      vnp_Locale: config.locale,
      vnp_ReturnUrl: returnUrl.toString(),
      vnp_IpAddr: input.ipAddress,
      vnp_CreateDate: vnpayDate(input.createdAt),
      vnp_ExpireDate: vnpayDate(input.expiresAt),
    };
    const query = vnpayQuery(params);
    return Promise.resolve({
      kind: 'redirect',
      providerReference,
      checkoutUrl: `${VNPAY_ENDPOINTS[config.environment].checkout}?${query}&vnp_SecureHash=${vnpayHash(query, hashSecret)}`,
    });
  }

  verifyWebhook(input: PaymentWebhookInput): Promise<NormalizedPaymentEvent> {
    if (!input.connection) throw new PaymentProviderUnavailableException();
    const { config, hashSecret } = readyVnpayConnection(input.connection);
    if (
      input.connection.code !== input.providerCode ||
      input.rawBody.length > 32_768
    ) {
      throw new InvalidBillingInputException(
        'Kết nối hoặc payload VNPAY không hợp lệ',
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(input.rawBody.toString('utf8'));
    } catch {
      throw new InvalidBillingInputException('Payload VNPAY không hợp lệ');
    }
    const fields = readVnpayFields(value);
    const signature = fields.vnp_SecureHash ?? '';
    delete fields.vnp_SecureHash;
    delete fields.vnp_SecureHashType;
    assertVnpayHash(vnpayQuery(fields), signature, hashSecret);
    if (
      fields.vnp_TmnCode !== config.tmnCode ||
      (fields.vnp_CurrCode && fields.vnp_CurrCode !== 'VND')
    ) {
      throw new InvalidBillingInputException(
        'Merchant hoặc tiền tệ VNPAY không khớp',
      );
    }
    const response = fields.vnp_ResponseCode;
    const status = fields.vnp_TransactionStatus;
    if (response === '00' && status === '00') {
      return Promise.resolve(
        vnpayEvent(fields, 'payment.succeeded', new Date()),
      );
    }
    // Pending, fraud review, reversal and unknown codes need reconciliation;
    // none constitutes proof of failure or a refund that permits ledger changes.
    const failures = [
      '09',
      '10',
      '11',
      '12',
      '13',
      '24',
      '51',
      '65',
      '75',
      '79',
    ];
    if (status === '02' && failures.includes(response)) {
      return Promise.resolve(vnpayEvent(fields, 'payment.failed', new Date()));
    }
    throw new PaymentProviderUnavailableException(
      'VNPAY chưa xác nhận trạng thái cuối cùng; cần đối soát',
    );
  }

  queryPayment(input: PaymentQueryInput): Promise<PaymentQueryResult> {
    return this.operations.queryPayment(input);
  }

  refundPayment(input: PaymentRefundInput): Promise<PaymentRefundResult> {
    return this.operations.refundPayment(input);
  }
}
