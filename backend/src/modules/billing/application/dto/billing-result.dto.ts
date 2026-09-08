import type { PaymentOrderStatusName } from '../../domain';

export interface CreditPackageResultDto {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

export interface PaymentOrderResultDto {
  readonly id: string;
  readonly packageId: string;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly status: PaymentOrderStatusName;
  readonly checkoutUrl: string | null;
  readonly fulfilment:
    | { readonly kind: 'redirect'; readonly checkoutUrl: string }
    | {
        readonly kind: 'instructions';
        readonly instructions: Readonly<Record<string, unknown>>;
      }
    | { readonly kind: 'none' };
  readonly transferClaim: Readonly<Record<string, unknown>> | null;
  readonly expiresAt: string;
  readonly settledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaymentMethodResultDto {
  readonly id: string;
  readonly code: string;
  readonly kind: import('../../domain').PaymentProviderKindName;
  readonly displayName: string;
  readonly description: string | null;
  readonly currency: string;
  readonly sortOrder: number;
}

export interface PaymentOrderPageResultDto {
  readonly items: readonly PaymentOrderResultDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface CreatePaymentOrderResultDto {
  readonly order: PaymentOrderResultDto;
  readonly replayed: boolean;
}

export interface AdminPaymentOrderResultDto extends PaymentOrderResultDto {
  readonly userId: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly packageLabel: string;
  readonly walletTransactionId: string | null;
  readonly failureCode: string | null;
}

export interface AdminPaymentOrderPageResultDto {
  readonly items: readonly AdminPaymentOrderResultDto[];
  readonly pagination: PaymentOrderPageResultDto['pagination'];
}
