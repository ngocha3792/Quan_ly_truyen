import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurationException } from '@/common/exceptions';
import type { PaymentCredentialVaultPort } from '../../application/ports/payment-credential-vault.port';

@Injectable()
export class PaymentCredentialVault implements PaymentCredentialVaultPort {
  private readonly key: Buffer | null;
  constructor(config: ConfigService) {
    const root =
      config.get<string>('billing.credentialKeyBase64') ??
      config.get<string>('auth.mfa.encryptionKeyBase64');
    const decoded = root ? Buffer.from(root, 'base64') : null;
    this.key =
      decoded?.length === 32
        ? Buffer.from(
            hkdfSync(
              'sha256',
              decoded,
              'quan-ly-truyen',
              'payment-credentials:v1',
              32,
            ),
          )
        : null;
  }
  available(): boolean {
    return this.key !== null;
  }
  seal(code: string, secrets: Readonly<Record<string, string>>): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`payment:${code}:v1`));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(secrets), 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      encrypted.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('.');
  }
  open(
    code: string,
    envelope?: string | null,
  ): Readonly<Record<string, string>> {
    if (!envelope) return {};
    const key = this.requireKey();
    try {
      if (envelope.length > 8192) throw new Error();
      const [version, ivText, dataText, tagText, extra] = envelope.split('.');
      if (version !== 'v1' || extra || !ivText || !dataText || !tagText)
        throw new Error();
      const iv = Buffer.from(ivText, 'base64url');
      const tag = Buffer.from(tagText, 'base64url');
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const cipher = createDecipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(`payment:${code}:v1`));
      cipher.setAuthTag(tag);
      const value: unknown = JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(dataText, 'base64url')),
          cipher.final(),
        ]).toString('utf8'),
      );
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.values(value).some((v) => typeof v !== 'string')
      )
        throw new Error();
      return value as Record<string, string>;
    } catch {
      throw new ConfigurationException({
        code: 'PAYMENT_CREDENTIAL_INVALID',
        message:
          'Không giải mã được khóa thanh toán. Kiểm tra khóa mã hóa máy chủ.',
      });
    }
  }
  private requireKey(): Buffer {
    if (!this.key)
      throw new ConfigurationException({
        code: 'PAYMENT_CREDENTIAL_KEY_REQUIRED',
        message: 'Máy chủ cần khóa mã hóa trước khi lưu khóa thanh toán.',
      });
    return this.key;
  }
}
