import {
  PaymentProviderConnection,
  PaymentProviderKind,
  PaymentProviderKindSchema,
  PaymentProviderWrite,
} from './admin-payment.models';

export interface ProviderDraft {
  id: string | null;
  code: string;
  kind: PaymentProviderKind;
  displayName: string;
  description: string;
  currency: string;
  enabled: boolean;
  sortOrder: number;
  orderTtlMinutes: number;
  config: Record<string, string>;
  credentials: Record<string, string>;
}

export function emptyProviderDraft(): ProviderDraft {
  return {
    id: null,
    code: '',
    kind: 'MANUAL_BANK_TRANSFER',
    displayName: '',
    description: '',
    currency: 'VND',
    enabled: false,
    sortOrder: 10,
    orderTtlMinutes: 2880,
    config: { transferNoteTemplate: 'NAP {{reference}}' },
    credentials: {},
  };
}

export function editProviderDraft(
  provider: PaymentProviderConnection,
  schema?: PaymentProviderKindSchema,
): ProviderDraft {
  const secrets = new Set(
    schema?.fields.filter((field) => field.secret).map((field) => field.name),
  );
  return {
    id: provider.id,
    code: provider.code,
    kind: provider.kind,
    displayName: provider.displayName,
    description: provider.description ?? '',
    currency: provider.currency,
    enabled: provider.enabled,
    sortOrder: provider.sortOrder,
    orderTtlMinutes: provider.orderTtlMinutes ?? 30,
    config: Object.fromEntries(
      Object.entries(provider.config).filter(
        ([key, value]) => !secrets.has(key) && typeof value === 'string',
      ),
    ) as Record<string, string>,
    credentials: {},
  };
}

export function providerWrite(
  draft: ProviderDraft,
  schema?: PaymentProviderKindSchema,
): PaymentProviderWrite {
  const secretNames = new Set(
    schema?.fields.filter((field) => field.secret).map((field) => field.name),
  );
  const credentials = Object.fromEntries(
    Object.entries(draft.credentials).filter(
      ([key, value]) => secretNames.has(key) && value.trim().length > 0,
    ),
  );
  return {
    code: draft.code.trim(),
    kind: draft.kind,
    displayName: draft.displayName.trim(),
    description: draft.description.trim(),
    currency: draft.currency,
    enabled: draft.enabled,
    sortOrder: draft.sortOrder,
    orderTtlMinutes: draft.orderTtlMinutes,
    config: Object.fromEntries(
      Object.entries(draft.config).filter(([key]) => !secretNames.has(key)),
    ),
    ...(Object.keys(credentials).length ? { credentials } : {}),
  };
}
