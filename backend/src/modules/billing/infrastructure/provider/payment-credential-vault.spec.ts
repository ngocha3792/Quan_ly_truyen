import { ConfigService } from '@nestjs/config';
import { PaymentCredentialVault } from './payment-credential-vault';

describe('payment credential vault', () => {
  const make = (key?: string) =>
    new PaymentCredentialVault(
      new ConfigService({ auth: { mfa: { encryptionKeyBase64: key } } }),
    );
  it('allows drafts without key but fails closed on secret storage', () => {
    const vault = make();
    expect(vault.available()).toBe(false);
    expect(vault.open('vnpay', null)).toEqual({});
    expect(() =>
      vault.seal('vnpay', { hashSecret: 'merchant-secret' }),
    ).toThrow();
  });
  it('encrypts authenticated random envelopes bound to provider code', () => {
    const vault = make(Buffer.alloc(32, 5).toString('base64'));
    const a = vault.seal('vnpay', { hashSecret: 'merchant-secret' });
    const b = vault.seal('vnpay', { hashSecret: 'merchant-secret' });
    expect(a).not.toBe(b);
    expect(a).not.toContain('merchant-secret');
    expect(vault.open('vnpay', a)).toEqual({ hashSecret: 'merchant-secret' });
    expect(() => vault.open('other', a)).toThrow();
    expect(() =>
      make(Buffer.alloc(32, 6).toString('base64')).open('vnpay', a),
    ).toThrow();
    const parts = a.split('.');
    parts[2] = 'tampered';
    expect(() => vault.open('vnpay', parts.join('.'))).toThrow();
  });
});
