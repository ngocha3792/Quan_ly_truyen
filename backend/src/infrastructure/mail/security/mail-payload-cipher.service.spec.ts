import type { MailConfig } from '@/config';

import type { SendMailJobV1 } from '@/infrastructure/queue/contracts';

import { MailPayloadCipherException } from '../exceptions';

import { MailPayloadCipherService } from './mail-payload-cipher.service';

describe('MailPayloadCipherService', () => {
  const payload: SendMailJobV1 = {
    version: 1,

    templateId: 'email-verification.v1',

    recipientEmail: 'reader@example.test',

    variables: {
      verificationUrl:
        'https://app.example.test/verify-email?token=raw-secret-token',
    },
  };

  it('encrypts and decrypts the complete mail payload', () => {
    const cipher = createCipher();

    const encrypted = cipher.encrypt(payload);

    expect(JSON.stringify(encrypted)).not.toContain('raw-secret-token');

    expect(cipher.decrypt(encrypted)).toEqual(payload);
  });

  it('uses a fresh IV for every encryption', () => {
    const cipher = createCipher();

    const first = cipher.encrypt(payload);

    const second = cipher.encrypt(payload);

    expect(first.iv).not.toBe(second.iv);

    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('rejects a modified authentication tag', () => {
    const cipher = createCipher();

    const encrypted = cipher.encrypt(payload);

    const tampered = {
      ...encrypted,

      authTag: Buffer.alloc(16, 9).toString('base64'),
    };

    try {
      cipher.decrypt(tampered);
      throw new Error('Expected decryption to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(MailPayloadCipherException);
      expect((error as MailPayloadCipherException).code).toBe(
        'MAIL_PAYLOAD_DECRYPTION_FAILED',
      );
    }
  });

  it('rejects a key that is not exactly 32 bytes', () => {
    try {
      createCipher(Buffer.alloc(16, 1).toString('base64'));
      throw new Error('Expected cipher creation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(MailPayloadCipherException);
      expect((error as MailPayloadCipherException).code).toBe(
        'MAIL_PAYLOAD_ENCRYPTION_KEY_INVALID',
      );
    }
  });

  it('does not expose plaintext in cipher errors', () => {
    const cipher = createCipher();

    const encrypted = cipher.encrypt(payload);

    try {
      cipher.decrypt({
        ...encrypted,

        ciphertext: Buffer.from('tampered').toString('base64'),
      });

      throw new Error('Expected decryption to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(MailPayloadCipherException);

      expect(String(error)).not.toContain('raw-secret-token');

      expect(String(error)).not.toContain('verify-email?token=');
    }
  });
});

function createCipher(
  keyBase64 = Buffer.alloc(32, 7).toString('base64'),
): MailPayloadCipherService {
  const mailConfig: MailConfig = {
    enabled: true,

    fromName: 'Quan Ly Truyen',

    fromAddress: 'no-reply@example.test',

    frontendPublicUrl: 'https://app.example.test',

    messageIdDomain: 'mail.example.test',

    smtp: {
      host: 'localhost',

      port: 1025,

      secure: false,

      requireTls: false,

      poolEnabled: true,

      maxConnections: 3,

      maxMessages: 100,

      rateLimitPerSecond: 5,

      connectionTimeoutMs: 10_000,

      greetingTimeoutMs: 10_000,

      socketTimeoutMs: 30_000,

      verifyOnStartup: false,
    },

    dkim: {
      enabled: false,
    },

    payloadEncryption: {
      keyBase64,

      allowLegacyPlaintextRead: true,
    },
  };

  return new MailPayloadCipherService({
    getOrThrow: jest.fn().mockReturnValue(mailConfig),
  } as never);
}
