import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ConfigurationException,
  InvalidTokenException,
} from '@/common/exceptions';
import type { AiConfig } from '@/config';

import type { AiCredentialVaultPort } from '../../application/ports/ai-credential-vault.port';

const AAD = Buffer.from('quan-ly-truyen:ai-api-key:v1', 'utf8');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_ENVELOPE_LENGTH = 4_096;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

@Injectable()
export class AiApiKeyCipherAdapter implements AiCredentialVaultPort {
  private readonly key: Buffer | null;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AiConfig>('ai');
    const encoded = config.encryptionKeyBase64;
    this.key = encoded ? Buffer.from(encoded, 'base64') : null;
  }

  encrypt(secret: string): Promise<string> {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);

    return Promise.resolve(
      [
        'v1',
        iv.toString('base64url'),
        ciphertext.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
      ].join('.'),
    );
  }

  decrypt(envelope: string): Promise<string> {
    const key = this.requireKey();
    if (envelope.length > MAX_ENVELOPE_LENGTH) {
      throw invalidCredentialEnvelope();
    }

    const parts = envelope.split('.');
    const [version, ivText, ciphertextText, tagText] = parts;
    if (
      parts.length !== 4 ||
      version !== 'v1' ||
      !ivText ||
      !ciphertextText ||
      !tagText
    ) {
      throw invalidCredentialEnvelope();
    }

    const iv = decodeCanonicalBase64Url(ivText);
    const ciphertext = decodeCanonicalBase64Url(ciphertextText);
    const tag = decodeCanonicalBase64Url(tagText);
    if (
      !iv ||
      !ciphertext ||
      !tag ||
      iv.length !== IV_BYTES ||
      ciphertext.length === 0 ||
      tag.length !== TAG_BYTES
    ) {
      throw invalidCredentialEnvelope();
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(AAD);
      decipher.setAuthTag(tag);
      return Promise.resolve(
        Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
          'utf8',
        ),
      );
    } catch {
      throw invalidCredentialEnvelope();
    }
  }

  private requireKey(): Buffer {
    if (!this.key || this.key.length !== 32) {
      throw new ConfigurationException({
        code: 'AI_API_KEY_ENCRYPTION_KEY_INVALID',
        message: 'Khóa mã hóa API key AI chưa được cấu hình đúng',
      });
    }
    return this.key;
  }
}

function decodeCanonicalBase64Url(value: string): Buffer | null {
  if (!BASE64URL_PATTERN.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}

function invalidCredentialEnvelope(): InvalidTokenException {
  return new InvalidTokenException({
    code: 'AI_API_KEY_INVALID',
    message: 'Dữ liệu API key không hợp lệ',
  });
}
