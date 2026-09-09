import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ConfigurationException,
  InvalidTokenException,
} from '@/common/exceptions';
import type { AiConfig } from '@/config';

import type { TtsCredentialVaultPort } from '../../application';

const AAD = Buffer.from('quan-ly-truyen:tts-api-key:v1', 'utf8');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_ENVELOPE_LENGTH = 4_096;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

@Injectable()
export class TtsApiKeyCipherAdapter implements TtsCredentialVaultPort {
  private readonly key: Buffer | null;

  constructor(configService: ConfigService) {
    const encoded =
      configService.getOrThrow<AiConfig>('ai').encryptionKeyBase64;
    this.key = encoded ? Buffer.from(encoded, 'base64') : null;
  }

  encrypt(secret: string): Promise<string> {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(AAD);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return Promise.resolve(
      [
        'v1',
        iv.toString('base64url'),
        encrypted.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
      ].join('.'),
    );
  }

  decrypt(envelope: string): Promise<string> {
    const key = this.requireKey();
    if (envelope.length > MAX_ENVELOPE_LENGTH) throw invalidEnvelope();
    const [version, ivText, encryptedText, tagText, extra] =
      envelope.split('.');
    if (version !== 'v1' || !ivText || !encryptedText || !tagText || extra)
      throw invalidEnvelope();
    const iv = decode(ivText);
    const encrypted = decode(encryptedText);
    const tag = decode(tagText);
    if (
      !iv ||
      !encrypted ||
      !tag ||
      iv.length !== IV_BYTES ||
      !encrypted.length ||
      tag.length !== TAG_BYTES
    ) {
      throw invalidEnvelope();
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(AAD);
      decipher.setAuthTag(tag);
      return Promise.resolve(
        Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
          'utf8',
        ),
      );
    } catch {
      throw invalidEnvelope();
    }
  }

  private requireKey(): Buffer {
    if (!this.key || this.key.length !== 32) {
      throw new ConfigurationException({
        code: 'TTS_API_KEY_ENCRYPTION_KEY_INVALID',
        message: 'Khóa mã hóa API key TTS chưa được cấu hình đúng',
      });
    }
    return this.key;
  }
}

function decode(value: string): Buffer | null {
  if (!BASE64URL_PATTERN.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}

function invalidEnvelope(): InvalidTokenException {
  return new InvalidTokenException({
    code: 'TTS_API_KEY_INVALID',
    message: 'Dữ liệu API key TTS không hợp lệ',
  });
}
