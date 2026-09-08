export type PaymentProviderKind = 'MANUAL_BANK_TRANSFER' | 'HMAC_SANDBOX';

export interface PaymentProviderConnection {
  readonly id: string;
  readonly code: string;
  readonly kind: PaymentProviderKind;
  readonly displayName: string;
  readonly description: string | null;
  readonly config: Record<string, unknown>;
  readonly currency: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly orderTtlMinutes: number | null;
}

export interface PaymentProviderKindSchema {
  readonly kind: PaymentProviderKind;
  readonly supportsWebhook: boolean;
  readonly requiresManualReview: boolean;
  readonly fields: readonly {
    readonly name: string;
    readonly label: string;
    readonly required: boolean;
    readonly placeholder?: string;
  }[];
}

export interface ManualReviewOrder {
  readonly id: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly packageLabel: string;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly status: 'AWAITING_REVIEW';
  readonly transferClaim: Record<string, unknown> | null;
  readonly createdAt: string;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly pagination: { readonly totalItems: number };
}
