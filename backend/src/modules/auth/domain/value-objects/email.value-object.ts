import { InvalidInputException } from '@/common/exceptions';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): EmailValueObject {
    if (typeof rawValue !== 'string') {
      throw new InvalidInputException({
        code: 'AUTH_INVALID_EMAIL',
        message: 'Email không hợp lệ',
      });
    }

    const normalizedValue = rawValue.trim().toLowerCase();

    if (
      normalizedValue.length < 3 ||
      normalizedValue.length > 320 ||
      !EMAIL_PATTERN.test(normalizedValue)
    ) {
      throw new InvalidInputException({
        code: 'AUTH_INVALID_EMAIL',
        message: 'Email không hợp lệ',
        details: {
          field: 'email',
        },
      });
    }

    return new EmailValueObject(normalizedValue);
  }

  equals(other: EmailValueObject): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
