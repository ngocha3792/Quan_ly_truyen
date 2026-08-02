import { InvalidInputException } from '@/common/exceptions';

export class DisplayNameValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): DisplayNameValueObject {
    if (typeof rawValue !== 'string') {
      throw new InvalidInputException({
        code: 'AUTH_INVALID_DISPLAY_NAME',
        message: 'Tên hiển thị không hợp lệ',
      });
    }

    const normalizedValue = rawValue.trim().replace(/\s+/g, ' ');

    if (normalizedValue.length < 1 || normalizedValue.length > 120) {
      throw new InvalidInputException({
        code: 'AUTH_INVALID_DISPLAY_NAME',
        message: 'Tên hiển thị phải có độ dài từ 1 đến 120 ký tự',
        details: {
          field: 'displayName',
        },
      });
    }

    return new DisplayNameValueObject(normalizedValue);
  }

  toString(): string {
    return this.value;
  }
}
