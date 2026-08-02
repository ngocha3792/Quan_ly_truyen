import { InvalidInputException } from '@/common/exceptions';

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export class UsernameValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): UsernameValueObject {
    if (typeof rawValue !== 'string') {
      throw new InvalidInputException({
        code: 'AUTH_INVALID_USERNAME',
        message: 'Tên đăng nhập không hợp lệ',
      });
    }

    const normalizedValue = rawValue.trim().toLowerCase();

    if (
      normalizedValue.length < 3 ||
      normalizedValue.length > 50 ||
      !USERNAME_PATTERN.test(normalizedValue)
    ) {
      throw new InvalidInputException({
        code: 'AUTH_INVALID_USERNAME',
        message:
          'Tên đăng nhập phải có từ 3 đến 50 ký tự và chỉ gồm chữ cái, chữ số hoặc dấu gạch dưới',
        details: {
          field: 'username',
        },
      });
    }

    return new UsernameValueObject(normalizedValue);
  }

  equals(other: UsernameValueObject): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
