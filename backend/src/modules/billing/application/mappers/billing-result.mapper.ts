import type {
  CreditPackageRecord,
  AdminPaymentOrderPageRecord,
  PaymentOrderPageRecord,
  PaymentOrderRecord,
} from '../ports';
import type {
  CreditPackageResultDto,
  AdminPaymentOrderPageResultDto,
  PaymentOrderPageResultDto,
  PaymentOrderResultDto,
} from '../dto';

export function toCreditPackageResult(
  record: CreditPackageRecord,
): CreditPackageResultDto {
  return {
    ...record,
    creditAmount: record.creditAmount.toString(),
    fiatAmountMinor: record.fiatAmountMinor.toString(),
  };
}

export function toAdminPaymentOrderPageResult(
  record: AdminPaymentOrderPageRecord,
): AdminPaymentOrderPageResultDto {
  return {
    items: record.items.map((item) => ({
      ...toPaymentOrderResult(item),
      userId: item.userId,
      userEmail: item.userEmail,
      userDisplayName: item.userDisplayName,
      packageLabel: item.packageLabel,
      walletTransactionId: item.walletTransactionId,
      failureCode: item.failureCode,
    })),
    pagination: {
      page: record.page,
      pageSize: record.pageSize,
      totalItems: record.total,
      totalPages: Math.ceil(record.total / record.pageSize),
    },
  };
}

export function toPaymentOrderResult(
  record: PaymentOrderRecord,
): PaymentOrderResultDto {
  return {
    id: record.id,
    packageId: record.packageId,
    provider: record.provider,
    providerReference: record.providerReference,
    creditAmount: record.creditAmount.toString(),
    fiatAmountMinor: record.fiatAmountMinor.toString(),
    currency: record.currency,
    status: record.status,
    checkoutUrl: record.checkoutUrl,
    expiresAt: record.expiresAt.toISOString(),
    settledAt: record.settledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toPaymentOrderPageResult(
  record: PaymentOrderPageRecord,
): PaymentOrderPageResultDto {
  return {
    items: record.items.map(toPaymentOrderResult),
    pagination: {
      page: record.page,
      pageSize: record.pageSize,
      totalItems: record.total,
      totalPages: Math.ceil(record.total / record.pageSize),
    },
  };
}
