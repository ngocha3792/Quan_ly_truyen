import bcrypt from 'bcryptjs';

export const DEFAULT_BCRYPT_ROUNDS = 12;
export const MIN_BCRYPT_ROUNDS = 10;
export const MAX_BCRYPT_ROUNDS = 15;
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export interface HashPasswordOptions {
  rounds?: number;
}

export function assertValidBcryptRounds(rounds: number): void {
  if (!Number.isInteger(rounds)) {
    throw new TypeError('Số vòng bcrypt phải là số nguyên');
  }

  if (rounds < MIN_BCRYPT_ROUNDS || rounds > MAX_BCRYPT_ROUNDS) {
    throw new RangeError(
      `Số vòng bcrypt phải nằm trong khoảng ${MIN_BCRYPT_ROUNDS}-${MAX_BCRYPT_ROUNDS}`,
    );
  }
}

export function assertPasswordFitsBcrypt(password: string): void {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Mật khẩu phải là chuỗi không rỗng');
  }

  if (bcrypt.truncates(password)) {
    throw new RangeError(
      `Mật khẩu vượt quá giới hạn ${BCRYPT_MAX_PASSWORD_BYTES} byte của bcrypt`,
    );
  }
}

export async function hashPassword(
  password: string,
  options: HashPasswordOptions = {},
): Promise<string> {
  const rounds = options.rounds ?? DEFAULT_BCRYPT_ROUNDS;

  assertPasswordFitsBcrypt(password);
  assertValidBcryptRounds(rounds);

  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (!isBcryptHash(passwordHash)) {
    return false;
  }

  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    return false;
  }

  if (bcrypt.truncates(plainPassword)) {
    return false;
  }

  return bcrypt.compare(plainPassword, passwordHash);
}

export function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}

export function getBcryptRounds(passwordHash: string): number {
  if (!isBcryptHash(passwordHash)) {
    throw new TypeError('Hash bcrypt không hợp lệ');
  }

  return bcrypt.getRounds(passwordHash);
}

export function needsPasswordRehash(
  passwordHash: string,
  desiredRounds = DEFAULT_BCRYPT_ROUNDS,
): boolean {
  assertValidBcryptRounds(desiredRounds);

  if (!isBcryptHash(passwordHash)) {
    return true;
  }

  return getBcryptRounds(passwordHash) !== desiredRounds;
}
