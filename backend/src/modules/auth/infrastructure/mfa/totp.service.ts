import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthConfig } from '@/config';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;
const DIGITS = 6;

@Injectable()
export class TotpService {
  private readonly issuer: string;
  private readonly window: number;
  private readonly recoveryCodeCount: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AuthConfig>('auth');
    this.issuer = config.adminMfa.issuer;
    this.window = config.adminMfa.totpWindow;
    this.recoveryCodeCount = config.adminMfa.recoveryCodeCount;
  }

  generateSecret(): string {
    return encodeBase32(randomBytes(20));
  }

  buildOtpAuthUri(secret: string, email: string): string {
    const label = encodeURIComponent(`${this.issuer}:${email}`);
    const query = new URLSearchParams({
      secret,
      issuer: this.issuer,
      algorithm: 'SHA1',
      digits: String(DIGITS),
      period: String(PERIOD_SECONDS),
    });
    return `otpauth://totp/${label}?${query.toString()}`;
  }

  verify(code: string, secret: string, now = new Date()): bigint | null {
    const normalized = code.trim();
    if (!/^\d{6}$/u.test(normalized)) {
      return null;
    }

    const current = BigInt(Math.floor(now.getTime() / 1000 / PERIOD_SECONDS));
    for (let offset = -this.window; offset <= this.window; offset += 1) {
      const step = current + BigInt(offset);
      if (step < 0n) {
        continue;
      }
      const expected = generateTotp(secret, step);
      const left = Buffer.from(normalized, 'utf8');
      const right = Buffer.from(expected, 'utf8');
      if (left.length === right.length && timingSafeEqual(left, right)) {
        return step;
      }
    }
    return null;
  }

  generateRecoveryCodes(): string[] {
    return Array.from({ length: this.recoveryCodeCount }, () => {
      const raw = randomBytes(8).toString('hex').toUpperCase();
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
    });
  }
}

function generateTotp(secret: string, counter: bigint): string {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/u, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error('Invalid base32 secret');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
