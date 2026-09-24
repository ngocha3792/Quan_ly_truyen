import { ManualReviewOrder } from './admin-payment.models';

/** Đơn chờ duyệt quá mốc này bị coi là trễ, khớp đúng cách API đếm quá hạn. */
const OVERDUE_HOURS = 24;

export function isOverdue(order: ManualReviewOrder): boolean {
  if (order.status !== 'AWAITING_REVIEW') return false;
  const createdAt = Date.parse(order.createdAt);
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt > OVERDUE_HOURS * 3_600_000;
}

/**
 * Mã hiển thị của đơn. Ưu tiên mã người gửi tự khai vì đó là mã họ ghi trên
 * uỷ nhiệm chi, tức là thứ admin dò trên sao kê.
 */
export function reference(order: ManualReviewOrder): string {
  const claimed = order.transferClaim?.['referenceCode'];
  if (typeof claimed === 'string' && claimed.trim()) return claimed.trim();
  return order.providerReference ?? order.id.slice(0, 8).toUpperCase();
}
