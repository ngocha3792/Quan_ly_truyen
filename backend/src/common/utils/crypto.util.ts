import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export type BinaryEncoding = 'base64' | 'base64url' | 'hex';

export function generateSecureToken(
  byteLength = 32,
  encoding: BinaryEncoding = 'base64url',
): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new RangeError('Độ dài token phải là số nguyên từ 16 byte trở lên');
  }

  return randomBytes(byteLength).toString(encoding);
}

export function sha256(
  value: string | Buffer,
  encoding: BinaryEncoding = 'hex',
): string {
  return createHash('sha256').update(value).digest(encoding);
}

export function hmacSha256(
  value: string | Buffer,
  secret: string | Buffer,
  encoding: BinaryEncoding = 'hex',
): string {
  return createHmac('sha256', secret).update(value).digest(encoding);
}

export function timingSafeEqualStrings(
  left: string,
  right: string,
): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function randomIntegerInclusive(min: number, max: number): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new TypeError('min và max phải là số nguyên an toàn');
  }

  if (min > max) {
    throw new RangeError('min không được lớn hơn max');
  }

  return randomInt(min, max + 1);
}

export function generateNumericCode(length = 6): string {
  if (!Number.isInteger(length) || length < 4 || length > 12) {
    throw new RangeError('Độ dài mã số phải nằm trong khoảng 4-12');
  }

  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += randomInt(0, 10).toString();
  }

  return result;
}
