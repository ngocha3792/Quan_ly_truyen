import { Injectable } from '@nestjs/common';

import type {
  PaymentGatewayOrderInput,
  PaymentQueryInput,
  PaymentQueryResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from '../../application';
import { InvalidBillingInputException } from '../../domain';
import { readyVnpayConnection, VNPAY_ENDPOINTS } from './vnpay-config';
import {
  assertVnpayHash,
  readVnpayFields,
  type VnpayFields,
  vnpayAmount,
  vnpayDate,
  vnpayEvent,
  vnpayHash,
  vnpayReference,
  vnpayResponseSignature,
} from './vnpay-protocol';

// Official contract: https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html
@Injectable()
export class VnpayOperationsClient {
  async queryPayment(input: PaymentQueryInput): Promise<PaymentQueryResult> {
    const { config, hashSecret } = readyVnpayConnection(input.connection);
    assertOrder(input);
    const fields = {
      vnp_RequestId: requestId(input.requestId),
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: config.tmnCode,
      vnp_TxnRef: input.providerReference,
      vnp_TransactionDate: vnpayDate(input.createdAt),
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_IpAddr: config.serverIp,
      vnp_OrderInfo: `Doi soat ${input.providerReference}`,
    };
    const signature = Object.values(fields).join('|');
    const response = await this.exchange(
      input,
      fields,
      signature,
      hashSecret,
      'querydr',
    );
    if (!response)
      return { status: 'UNKNOWN', responseCode: 'UNVERIFIED_RESPONSE' };
    const responseCode = response.vnp_ResponseCode;
    if (responseCode !== '00') return { status: 'UNKNOWN', responseCode };
    const transactionType = response.vnp_TransactionType;
    const transactionStatus = response.vnp_TransactionStatus;
    if (
      transactionType === '01' &&
      input.providerTransactionId &&
      response.vnp_TransactionNo !== input.providerTransactionId
    ) {
      return { status: 'UNKNOWN', responseCode: 'TRANSACTION_MISMATCH' };
    }
    const providerTransactionId = response.vnp_TransactionNo;
    if (transactionStatus === '00' && ['01', '02'].includes(transactionType)) {
      try {
        const refunded = transactionType === '02';
        return {
          status: refunded ? 'REFUNDED' : 'SUCCEEDED',
          responseCode,
          providerTransactionId,
          event: vnpayEvent(
            response,
            refunded ? 'payment.refunded' : 'payment.succeeded',
            new Date(),
          ),
        };
      } catch {
        return { status: 'UNKNOWN', responseCode: 'INVALID_TRANSACTION' };
      }
    }
    if (transactionType === '01' && transactionStatus === '02') {
      try {
        return {
          status: 'FAILED',
          responseCode,
          providerTransactionId,
          event: vnpayEvent(response, 'payment.failed', new Date()),
        };
      } catch {
        return { status: 'UNKNOWN', responseCode: 'INVALID_TRANSACTION' };
      }
    }
    if (['01', '05', '06'].includes(transactionStatus))
      return { status: 'PENDING', responseCode, providerTransactionId };
    return { status: 'UNKNOWN', responseCode, providerTransactionId };
  }

  async refundPayment(input: PaymentRefundInput): Promise<PaymentRefundResult> {
    const { config, hashSecret } = readyVnpayConnection(input.connection);
    assertOrder(input);
    const fields = {
      vnp_RequestId: requestId(input.requestId),
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: config.tmnCode,
      vnp_TransactionType: '02',
      vnp_TxnRef: input.providerReference,
      vnp_Amount: vnpayAmount(input.amountMinor, input.currency),
      vnp_TransactionNo: input.providerTransactionId ?? '',
      vnp_TransactionDate: vnpayDate(input.createdAt),
      vnp_CreateBy: ascii(input.initiatedBy, 245),
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_IpAddr: config.serverIp,
      vnp_OrderInfo: ascii(input.reason, 255),
    };
    const response = await this.exchange(
      input,
      fields,
      Object.values(fields).join('|'),
      hashSecret,
      'refund',
    );
    if (!response)
      return { status: 'UNKNOWN', responseCode: 'UNVERIFIED_RESPONSE' };
    const responseCode = response.vnp_ResponseCode;
    if (responseCode === '94') return { status: 'PENDING', responseCode };
    if (['02', '03', '91', '95', '97'].includes(responseCode))
      return { status: 'FAILED', responseCode };
    if (responseCode !== '00' || response.vnp_TransactionType !== '02')
      return { status: 'UNKNOWN', responseCode };
    const providerRefundId = response.vnp_TransactionNo;
    if (!/^[1-9]\d{0,14}$/u.test(providerRefundId ?? ''))
      return { status: 'UNKNOWN', responseCode: 'INVALID_TRANSACTION' };
    if (response.vnp_TransactionStatus === '00')
      return { status: 'SUCCEEDED', responseCode, providerRefundId };
    if (['01', '05', '06'].includes(response.vnp_TransactionStatus))
      return { status: 'PENDING', responseCode, providerRefundId };
    if (['02', '09'].includes(response.vnp_TransactionStatus))
      return { status: 'FAILED', responseCode, providerRefundId };
    return { status: 'UNKNOWN', responseCode, providerRefundId };
  }

  private async exchange(
    input: PaymentGatewayOrderInput,
    fields: VnpayFields,
    signatureData: string,
    hashSecret: string,
    command: 'querydr' | 'refund',
  ): Promise<VnpayFields | null> {
    const { config } = readyVnpayConnection(input.connection);
    try {
      const response = await fetch(
        VNPAY_ENDPOINTS[config.environment].transaction,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            ...fields,
            vnp_SecureHash: vnpayHash(signatureData, hashSecret),
          }),
        },
      );
      if (!response.ok) return null;
      const text = await response.text();
      if (text.length > 65_536) return null;
      const result = readVnpayFields(JSON.parse(text));
      assertVnpayHash(
        vnpayResponseSignature(result, command),
        result.vnp_SecureHash ?? '',
        hashSecret,
      );
      if (
        !/^[a-zA-Z0-9]{1,32}$/u.test(result.vnp_ResponseId ?? '') ||
        (result.vnp_Command !== undefined &&
          result.vnp_Command !== '' &&
          result.vnp_Command !== command) ||
        result.vnp_TmnCode !== config.tmnCode ||
        result.vnp_TxnRef !== input.providerReference ||
        result.vnp_Amount !== vnpayAmount(input.amountMinor, input.currency)
      )
        return null;
      return result;
    } catch {
      // A timeout or unauthenticated response cannot establish that no funds moved.
      return null;
    }
  }
}

function assertOrder(input: PaymentGatewayOrderInput): void {
  if (
    input.providerReference !== vnpayReference(input.orderId) ||
    (input.providerTransactionId &&
      !/^[1-9]\d{0,14}$/u.test(input.providerTransactionId))
  ) {
    throw new InvalidBillingInputException('Giao dịch gốc VNPAY không hợp lệ');
  }
  vnpayAmount(input.amountMinor, input.currency);
}

function requestId(value: string): string {
  const normalized = value.replace(/-/gu, '');
  if (!/^[a-zA-Z0-9]{1,32}$/u.test(normalized))
    throw new InvalidBillingInputException('Mã yêu cầu VNPAY không hợp lệ');
  return normalized;
}

function ascii(value: string, maxLength: number): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/gu, 'd')
    .replace(/Đ/gu, 'D')
    .replace(/[^a-zA-Z0-9 ]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);
  if (!normalized)
    throw new InvalidBillingInputException(
      'Nội dung hoàn tiền VNPAY không hợp lệ',
    );
  return normalized;
}
