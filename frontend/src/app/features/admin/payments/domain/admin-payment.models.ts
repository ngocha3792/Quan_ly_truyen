export type PaymentProviderKind = 'MANUAL_BANK_TRANSFER' | 'HMAC_SANDBOX' | 'VNPAY';

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
  readonly configurationReady: boolean;
  readonly missingConfigurationFields: readonly string[];
  readonly secretConfiguredFields: readonly string[];
  readonly webhookUrl: string | null;
  readonly returnUrl: string | null;
  readonly credentialsStorageAvailable: boolean;
}

export type PaymentProviderWrite = Omit<
  PaymentProviderConnection,
  | 'id'
  | 'configurationReady'
  | 'missingConfigurationFields'
  | 'secretConfiguredFields'
  | 'webhookUrl'
  | 'returnUrl'
  | 'credentialsStorageAvailable'
> & { readonly credentials?: Readonly<Record<string, string>> };

export interface PaymentProviderField {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly placeholder?: string;
  readonly type?: 'text' | 'password' | 'url' | 'select';
  readonly secret?: boolean;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly defaultValue?: string;
}

export interface PaymentProviderKindSchema {
  readonly kind: PaymentProviderKind;
  readonly supportsWebhook: boolean;
  readonly requiresManualReview: boolean;
  readonly fields: readonly PaymentProviderField[];
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
