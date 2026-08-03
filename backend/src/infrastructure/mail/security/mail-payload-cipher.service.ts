import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MailConfig } from '@/config';
import {
  MAIL_PAYLOAD_ENCRYPTION_ALGORITHM,
  type EncryptedMailPayloadV1,
} from '@/infrastructure/queue/contracts';

import { MailPayloadCipherException } from '../exceptions';

const KEY_LENGTH_BYTES = 32;

/*
 * 96-bit IV là kích thước được khuyến nghị cho AES-GCM.
 */
const IV_LENGTH_BYTES = 12;

const AUTH_TAG_LENGTH_BYTES = 16;

/*
 * AAD tạo domain separation.
 *
 * Payload được mã hóa bởi service này sẽ không thể
 * được giải mã trong context mã hóa khác.
 */
const AAD = Buffer.from('quan-ly-truyen:mail-payload:v1', 'utf8');

@Injectable()
export class MailPayloadCipherService {
  private readonly key: Buffer | null;

  private readonly allowLegacyPlaintextRead: boolean;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.getOrThrow<MailConfig>('mail');

    this.key = decodeEncryptionKey(config.payloadEncryption.keyBase64);

    this.allowLegacyPlaintextRead =
      config.payloadEncryption.allowLegacyPlaintextRead;
  }

  encrypt(payload: unknown): EncryptedMailPayloadV1 {
    const key = this.requireKey();

    const plaintext = serializePayload(payload);

    try {
      const iv = randomBytes(IV_LENGTH_BYTES);

      const cipher = createCipheriv(
        MAIL_PAYLOAD_ENCRYPTION_ALGORITHM,
        key,
        iv,
        {
          authTagLength: AUTH_TAG_LENGTH_BYTES,
        },
      );

      cipher.setAAD(AAD);

      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      return {
        version: 1,

        algorithm: MAIL_PAYLOAD_ENCRYPTION_ALGORITHM,

        iv: iv.toString('base64'),

        ciphertext: ciphertext.toString('base64'),

        authTag: cipher.getAuthTag().toString('base64'),
      };
    } catch {
      throw new MailPayloadCipherException('MAIL_PAYLOAD_ENCRYPTION_FAILED');
    }
  }

  decrypt(payload: EncryptedMailPayloadV1): unknown {
    const key = this.requireKey();

    /*
     * Decode và kiểm tra kích thước trước khi gọi
     * crypto API.
     */
    const { iv, ciphertext, authTag } = decodeEnvelope(payload);

    try {
      const decipher = createDecipheriv(
        MAIL_PAYLOAD_ENCRYPTION_ALGORITHM,
        key,
        iv,
        {
          authTagLength: AUTH_TAG_LENGTH_BYTES,
        },
      );

      decipher.setAAD(AAD);

      decipher.setAuthTag(authTag);

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');

      return JSON.parse(plaintext) as unknown;
    } catch {
      /*
       * Không đưa lỗi crypto gốc ra ngoài.
       * Lỗi gốc có thể chứa thông tin không cần thiết.
       */
      throw new MailPayloadCipherException('MAIL_PAYLOAD_DECRYPTION_FAILED');
    }
  }

  /**
   * Compatibility tạm thời cho các plaintext job
   * đã tồn tại trước khi triển khai encryption.
   *
   * Sau khi outbox và queue cũ đã drain hết,
   * đặt env thành false.
   */
  canReadLegacyPlaintext(): boolean {
    return this.allowLegacyPlaintextRead;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new MailPayloadCipherException(
        'MAIL_PAYLOAD_ENCRYPTION_KEY_MISSING',
      );
    }

    return this.key;
  }
}

function serializePayload(payload: unknown): string {
  try {
    const serialized = JSON.stringify(payload);

    if (serialized === undefined) {
      throw new Error('Payload is not JSON serializable');
    }

    return serialized;
  } catch {
    throw new MailPayloadCipherException('MAIL_PAYLOAD_ENCRYPTION_FAILED');
  }
}

function decodeEncryptionKey(value: string | undefined): Buffer | null {
  if (!value?.trim()) {
    return null;
  }

  const decoded = decodeBase64Strict(value);

  if (!decoded || decoded.length !== KEY_LENGTH_BYTES) {
    throw new MailPayloadCipherException('MAIL_PAYLOAD_ENCRYPTION_KEY_INVALID');
  }

  return decoded;
}

function decodeEnvelope(payload: EncryptedMailPayloadV1): {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
} {
  const iv = decodeBase64Strict(payload.iv);

  const ciphertext = decodeBase64Strict(payload.ciphertext);

  const authTag = decodeBase64Strict(payload.authTag);

  if (
    !iv ||
    iv.length !== IV_LENGTH_BYTES ||
    !ciphertext ||
    ciphertext.length === 0 ||
    !authTag ||
    authTag.length !== AUTH_TAG_LENGTH_BYTES
  ) {
    throw new MailPayloadCipherException('MAIL_PAYLOAD_ENVELOPE_INVALID');
  }

  return {
    iv,
    ciphertext,
    authTag,
  };
}

function decodeBase64Strict(value: string): Buffer | null {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    return null;
  }

  const decoded = Buffer.from(normalized, 'base64');

  const canonical = decoded.toString('base64').replace(/=+$/u, '');

  const input = normalized.replace(/=+$/u, '');

  return canonical === input ? decoded : null;
}
