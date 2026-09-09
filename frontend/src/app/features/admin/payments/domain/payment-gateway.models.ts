export interface GatewayOrder {
  readonly id: string;
  readonly userEmail: string;
  readonly provider: string;
  readonly providerKind: string;
  readonly providerConfigurationReady: boolean;
  readonly providerReference: string | null;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface GatewayRefund {
  readonly id: string;
  readonly status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
  readonly amountMinor: string;
  readonly currency: string;
  readonly reason: string;
  readonly providerRefundId: string | null;
  readonly createdAt: string;
}

export interface GatewayReconciliation {
  readonly status: string;
  readonly providerStatus: string;
  readonly matched: boolean;
  readonly message: string;
}

export interface StoryPaymentAllowlist {
  readonly isEnabled: boolean;
  readonly enabledProviders: readonly string[];
}
