import { InvalidEmailChangeTokenException } from '../exceptions';

const BASE64_URL_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/u;

export class EmailChangeTokenValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): EmailChangeTokenValueObject {
    if (typeof rawValue !== 'string') {
      throw new InvalidEmailChangeTokenException();
    }

    const normalized = rawValue.trim();

    if (
      normalized.length < 32 ||
      normalized.length > 512 ||
      !BASE64_URL_TOKEN_PATTERN.test(normalized)
    ) {
      throw new InvalidEmailChangeTokenException();
    }

    return new EmailChangeTokenValueObject(normalized);
  }

  toString(): string {
    return this.value;
  }
}
