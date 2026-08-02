import { InvalidPasswordResetTokenException } from '../exceptions';

const BASE64_URL_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export class PasswordResetTokenValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): PasswordResetTokenValueObject {
    if (typeof rawValue !== 'string') {
      throw new InvalidPasswordResetTokenException();
    }

    const normalizedValue = rawValue.trim();

    if (
      normalizedValue.length < 32 ||
      normalizedValue.length > 512 ||
      !BASE64_URL_TOKEN_PATTERN.test(normalizedValue)
    ) {
      throw new InvalidPasswordResetTokenException();
    }

    return new PasswordResetTokenValueObject(normalizedValue);
  }

  toString(): string {
    return this.value;
  }
}
