export interface CreditWallet {
  readonly currency: 'CREDIT';
  readonly availableBalance: string;
  readonly version: number;
  readonly updatedAt: string | null;
}

export interface CreditPackage {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

export type PaymentOrderStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AWAITING_REVIEW'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'REVERSED';

export interface PaymentMethod {
  readonly id: string;
  readonly code: string;
  readonly kind: 'MANUAL_BANK_TRANSFER' | 'HMAC_SANDBOX';
  readonly displayName: string;
  readonly description: string | null;
  readonly currency: string;
  readonly sortOrder: number;
}

export type PaymentFulfilment =
  | { readonly kind: 'redirect'; readonly checkoutUrl: string }
  | { readonly kind: 'instructions'; readonly instructions: Record<string, unknown> }
  | { readonly kind: 'none' };

export interface PaymentOrder {
  readonly id: string;
  readonly packageId: string;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly status: PaymentOrderStatus;
  readonly checkoutUrl: string | null;
  readonly fulfilment: PaymentFulfilment;
  readonly transferClaim: Readonly<Record<string, unknown>> | null;
  readonly expiresAt: string;
  readonly settledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaymentOrderPage {
  readonly items: readonly PaymentOrder[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface CreatePaymentOrderResult {
  readonly order: PaymentOrder;
  readonly replayed: boolean;
}
