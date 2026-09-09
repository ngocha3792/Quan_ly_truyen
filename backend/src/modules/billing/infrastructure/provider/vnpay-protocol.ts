import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NormalizedPaymentEvent } from '../../application';
import { InvalidBillingInputException } from '../../domain';

export type VnpayFields = Readonly<Record<string, string>>;

// VNPAY PAY 2.1.0 uses sorted, URL-encoded fields with spaces encoded as '+'.
export function vnpayQuery(fields: VnpayFields): string {
  const encode = (value: string) =>
    encodeURIComponent(value).replace(/%20/gu, '+');
  return Object.keys(fields)
    .sort()
    .map((key) => `${encode(key)}=${encode(fields[key])}`)
    .join('&');
}

export function vnpayHash(value: string, secret: string): string {
  return createHmac('sha512', secret).update(value, 'utf8').digest('hex');
}

export function assertVnpayHash(
  value: string,
  signature: string,
  secret: string,
): void {
  if (
    !/^[a-fA-F0-9]{128}$/u.test(signature) ||
    !timingSafeEqual(
      Buffer.from(vnpayHash(value, secret), 'hex'),
      Buffer.from(signature, 'hex'),
    )
  )
    throw new InvalidBillingInputException('Chữ ký VNPAY không hợp lệ');
}

export function vnpayDate(date: Date): string {
  if (!Number.isFinite(date.getTime()))
    throw new InvalidBillingInputException('Ngày giao dịch không hợp lệ');
  return new Date(date.getTime() + 7 * 60 * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace(/[-:T]/gu, '');
}

export function parseVnpayDate(value: string): string {
  if (!/^\d{14}$/u.test(value))
    throw new InvalidBillingInputException('Ngày giao dịch VNPAY không hợp lệ');
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || vnpayDate(date) !== value) {
    throw new InvalidBillingInputException('Ngày giao dịch VNPAY không hợp lệ');
  }
  return date.toISOString();
}

export function vnpayAmount(amountMinor: bigint, currency: string): string {
  const scaled = amountMinor * 100n;
  if (currency !== 'VND' || scaled <= 0n || scaled > 999_999_999_999n) {
    throw new InvalidBillingInputException(
      'VNPAY chỉ hỗ trợ số tiền VND trong giới hạn thanh toán',
    );
  }
  return scaled.toString();
}

export function readVnpayAmount(value: string): string {
  if (!/^[1-9]\d{0,11}$/u.test(value) || BigInt(value) % 100n !== 0n) {
    throw new InvalidBillingInputException('Số tiền VNPAY không hợp lệ');
  }
  return (BigInt(value) / 100n).toString();
}

export function vnpayReference(orderId: string): string {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(
      orderId,
    )
  ) {
    throw new InvalidBillingInputException('Mã đơn VNPAY không hợp lệ');
  }
  return orderId.replace(/-/gu, '').toLowerCase();
}

export function readVnpayOrderId(reference: string): string {
  if (!/^[a-f0-9]{32}$/u.test(reference))
    throw new InvalidBillingInputException('Mã tham chiếu VNPAY không hợp lệ');
  return `${reference.slice(0, 8)}-${reference.slice(8, 12)}-${reference.slice(12, 16)}-${reference.slice(16, 20)}-${reference.slice(20)}`;
}

export function readVnpayFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidBillingInputException('Dữ liệu VNPAY không hợp lệ');
  }
  const fields: Record<string, string> = {};
  for (const [key, field] of Object.entries(value)) {
    if (
      !/^vnp_[A-Za-z]+$/u.test(key) ||
      typeof field !== 'string' ||
      field.length > 4096
    ) {
      throw new InvalidBillingInputException(
        'Trường dữ liệu VNPAY không hợp lệ',
      );
    }
    fields[key] = field;
  }
  return fields;
}

export function vnpayEvent(
  fields: VnpayFields,
  type: NormalizedPaymentEvent['type'],
  fallbackDate?: Date,
): NormalizedPaymentEvent {
  const transactionId = fields.vnp_TransactionNo;
  if (
    !/^\d{1,15}$/u.test(transactionId ?? '') ||
    (type === 'payment.succeeded' && transactionId === '0')
  ) {
    throw new InvalidBillingInputException('Mã giao dịch VNPAY không hợp lệ');
  }
  const payDate = fields.vnp_PayDate;
  const occurredAt = payDate
    ? parseVnpayDate(payDate)
    : fallbackDate?.toISOString();
  if (!occurredAt)
    throw new InvalidBillingInputException('Thiếu thời gian giao dịch VNPAY');
  return {
    eventId: `vnpay:${fields.vnp_TmnCode}:${fields.vnp_TxnRef}:${transactionId}:${type}`,
    type,
    orderId: readVnpayOrderId(fields.vnp_TxnRef),
    providerReference: fields.vnp_TxnRef,
    amountMinor: readVnpayAmount(fields.vnp_Amount),
    currency: 'VND',
    occurredAt,
    providerTransactionId: transactionId,
    ...(payDate ? { providerTransactionDate: payDate } : {}),
  };
}

// querydr/refund use positional values, NOT the PAY query-string signature.
export function vnpayResponseSignature(
  fields: VnpayFields,
  command: 'querydr' | 'refund',
): string {
  const keys = [
    'ResponseId',
    'Command',
    'ResponseCode',
    'Message',
    'TmnCode',
    'TxnRef',
    'Amount',
    'BankCode',
    'PayDate',
    'TransactionNo',
    'TransactionType',
    'TransactionStatus',
    'OrderInfo',
  ];
  if (command === 'querydr') keys.push('PromotionCode', 'PromotionAmount');
  return keys.map((key) => fields[`vnp_${key}`] ?? '').join('|');
}
