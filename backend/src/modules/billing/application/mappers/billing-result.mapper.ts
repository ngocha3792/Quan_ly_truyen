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
      providerKind: item.providerKind,
      providerConfigurationReady: item.providerConfigurationReady,
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
  const metadata = asObject(record.metadata);
  const instructions = asObject(metadata.instructions);
  const transferClaim = asObject(metadata.userClaim);
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
    fulfilment: record.checkoutUrl
      ? { kind: 'redirect', checkoutUrl: record.checkoutUrl }
      : Object.keys(instructions).length > 0
        ? { kind: 'instructions', instructions }
        : { kind: 'none' },
    transferClaim: Object.keys(transferClaim).length > 0 ? transferClaim : null,
    expiresAt: record.expiresAt.toISOString(),
    settledAt: record.settledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function asObject(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
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
