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
  readonly expiresAt: string;
  readonly settledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
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
