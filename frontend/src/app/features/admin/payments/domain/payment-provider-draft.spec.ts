import { describe, expect, it } from 'vitest';
import { PaymentProviderConnection, PaymentProviderKindSchema } from './admin-payment.models';
import { editProviderDraft, emptyProviderDraft, providerWrite } from './payment-provider-draft';

const schema: PaymentProviderKindSchema = {
  kind: 'VNPAY',
  supportsWebhook: true,
  requiresManualReview: false,
  fields: [
    { name: 'tmnCode', label: 'TMN', required: true },
    { name: 'hashSecret', label: 'Key', required: true, secret: true },
  ],
};

describe('provider drafts', () => {
  it('saves a disabled draft without inventing credentials or serializing read-only metadata', () => {
    const draft = { ...emptyProviderDraft(), kind: 'VNPAY' as const, config: { tmnCode: '' } };
    expect(providerWrite(draft, schema)).toMatchObject({ enabled: false, config: { tmnCode: '' } });
    expect(providerWrite(draft, schema)).not.toHaveProperty('credentials');
    expect(providerWrite(draft, schema)).not.toHaveProperty('configurationReady');
  });

  it('never fills secret inputs from config and preserves blank credentials on updates', () => {
    const saved = {
      ...providerWrite(emptyProviderDraft()),
      id: 'provider',
      kind: 'VNPAY',
      config: { tmnCode: 'MERCHANT', hashSecret: 'accidental-legacy-secret' },
      configurationReady: true,
      missingConfigurationFields: [],
      secretConfiguredFields: ['hashSecret'],
      credentialsStorageAvailable: true,
      webhookUrl: null,
      returnUrl: null,
    } as PaymentProviderConnection;
    const draft = editProviderDraft(saved, schema);
    draft.credentials['hashSecret'] = '  ';
    expect(draft.config).toEqual({ tmnCode: 'MERCHANT' });
    expect(providerWrite(draft, schema)).not.toHaveProperty('credentials');
    draft.credentials['hashSecret'] = 'new-secret';
    expect(providerWrite(draft, schema).credentials).toEqual({ hashSecret: 'new-secret' });
    expect(providerWrite(draft, schema).config).not.toHaveProperty('hashSecret');
  });
});
