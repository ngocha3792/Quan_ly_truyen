import { ConfigService } from '@nestjs/config';
import { ManagePaymentProvidersCommandHandler } from './manage-payment-providers.command-handler';
import { PaymentCredentialVault } from '../../../infrastructure/provider/payment-credential-vault';

const actor = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
describe('admin provider setup without merchant keys', () => {
  const config = new ConfigService({
    app: { publicUrl: 'https://story.test' },
    auth: {
      mfa: { encryptionKeyBase64: Buffer.alloc(32, 7).toString('base64') },
    },
  });
  const vault = new PaymentCredentialVault(config);
  const base = {
    id,
    code: 'vnpay',
    kind: 'VNPAY' as const,
    displayName: 'VNPAY',
    currency: 'VND',
    enabled: false,
    sortOrder: 0,
    orderTtlMinutes: 30,
    config: {
      tmnCode: 'TESTCODE',
      returnUrl: 'https://story.test/tai-khoan/credit/ket-qua-thanh-toan',
      serverIp: '127.0.0.1',
      environment: 'SANDBOX',
    },
  };
  const persistence = {
    listConnections: jest.fn(),
    createConnection: jest.fn(),
    updateConnection: jest.fn(),
  };
  const adapter = {
    validateConfig: (value: unknown) => value,
    assertReady: jest.fn((connection: { secrets?: Record<string, string> }) => {
      if (!connection.secrets?.hashSecret) throw new Error('missing secret');
    }),
  };
  const handler = new ManagePaymentProvidersCommandHandler(
    persistence as never,
    { getAdapter: () => adapter } as never,
    vault,
    config,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    persistence.listConnections.mockResolvedValue([base]);
    persistence.createConnection.mockImplementation((value: object) =>
      Promise.resolve({ ...base, ...value }),
    );
    persistence.updateConnection.mockImplementation((value: object) =>
      Promise.resolve({ ...base, ...value }),
    );
  });
  it('saves disabled no-key draft with missing fields and webhook instructions', async () => {
    const result = await handler.create(actor, { ...base, config: {} });
    expect(result.enabled).toBe(false);
    expect(result.configurationReady).toBe(false);
    expect(result.missingConfigurationFields).toContain('hashSecret');
    expect(result.webhookUrl).toContain('/webhooks/payments/vnpay/ipn');
  });
  it('stores secrets encrypted and never returns plaintext or ciphertext', async () => {
    const result = await handler.create(actor, {
      ...base,
      credentials: { hashSecret: 'merchant-secret' },
    });
    expect(result.configurationReady).toBe(true);
    expect(result.secretConfiguredFields).toEqual(['hashSecret']);
    expect(JSON.stringify(result)).not.toContain('merchant-secret');
    expect(result).not.toHaveProperty('encryptedCredential');
  });
  it('rejects activation without key and untrusted return origin', async () => {
    await expect(
      handler.create(actor, { ...base, enabled: true }),
    ).rejects.toThrow('missing secret');
    await expect(
      handler.create(actor, {
        ...base,
        config: { ...base.config, returnUrl: 'https://foreign.test/callback' },
      }),
    ).rejects.toThrow();
    expect(persistence.createConnection).not.toHaveBeenCalled();
  });
  it('empty password updates retain the previous credential', async () => {
    persistence.listConnections.mockResolvedValue([
      {
        ...base,
        encryptedCredential: vault.seal('vnpay', {
          hashSecret: 'merchant-secret',
        }),
      },
    ]);
    await handler.update(actor, id, {
      credentials: { hashSecret: '' },
      displayName: 'Renamed',
    });
    expect(persistence.updateConnection).toHaveBeenCalledWith(
      expect.not.objectContaining({
        encryptedCredential: expect.anything() as unknown,
      }),
    );
  });
});
