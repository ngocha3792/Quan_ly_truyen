import { InvalidEmailVerificationTokenException } from '../exceptions';

const BASE64_URL_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export class EmailVerificationTokenValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): EmailVerificationTokenValueObject {
    if (typeof rawValue !== 'string') {
      throw new InvalidEmailVerificationTokenException();
    }

    const normalizedValue = rawValue.trim();

    if (
      normalizedValue.length < 32 ||
      normalizedValue.length > 512 ||
      !BASE64_URL_TOKEN_PATTERN.test(normalizedValue)
    ) {
      throw new InvalidEmailVerificationTokenException();
    }

    return new EmailVerificationTokenValueObject(normalizedValue);
  }

  toString(): string {
    return this.value;
  }
}
