import { ManualBankTransferProviderAdapter } from './manual-bank-transfer-provider.adapter';

describe('ManualBankTransferProviderAdapter', () => {
  const adapter = new ManualBankTransferProviderAdapter();
  const connection = {
    id: '30000000-0000-4000-8000-000000000002',
    code: 'manual-bank-transfer',
    kind: 'MANUAL_BANK_TRANSFER' as const,
    displayName: 'Bank',
    config: {
      bankName: 'VCB',
      accountNumber: '123456',
      accountHolder: 'NGUYEN VAN A',
      branch: 'HCM',
      transferNoteTemplate: 'NAP {{reference}}',
      instructionNote: 'Giữ biên lai',
    },
    currency: 'VND',
    orderTtlMinutes: 2880,
  };

  it('validates config and renders stable transfer instructions', async () => {
    const result = await adapter.createCheckout({
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      connection,
      amountMinor: 50_000n,
      currency: 'VND',
      expiresAt: new Date(),
    });
    expect(result.kind).toBe('instructions');
    if (result.kind !== 'instructions') return;
    expect(result.providerReference).toBe('TTAAAAAAAAAAAA');
    expect(result.instructions.transferNote).toBe('NAP TTAAAAAAAAAAAA');
  });

  it('requires the reference placeholder', () => {
    expect(() =>
      adapter.validateConfig({
        ...connection.config,
        transferNoteTemplate: 'NAP TIEN',
      }),
    ).toThrow('{{reference}}');
  });

  it('does not accept webhooks', async () => {
    await expect(adapter.verifyWebhook()).rejects.toThrow(
      'không hỗ trợ webhook',
    );
  });
});
