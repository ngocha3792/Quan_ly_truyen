import { InvalidInputException } from '@/common/exceptions';
import { BCRYPT_MAX_PASSWORD_BYTES } from '@/common/utils';

const LOWERCASE_PATTERN = /[a-z]/;
const UPPERCASE_PATTERN = /[A-Z]/;
const NUMBER_PATTERN = /\d/;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/;

export class PasswordValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): PasswordValueObject {
    if (typeof rawValue !== 'string') {
      throw PasswordValueObject.invalid();
    }

    const byteLength = Buffer.byteLength(rawValue, 'utf8');

    const isValid =
      rawValue.length >= 8 &&
      rawValue.length <= 72 &&
      byteLength <= BCRYPT_MAX_PASSWORD_BYTES &&
      LOWERCASE_PATTERN.test(rawValue) &&
      UPPERCASE_PATTERN.test(rawValue) &&
      NUMBER_PATTERN.test(rawValue) &&
      SYMBOL_PATTERN.test(rawValue);

    if (!isValid) {
      throw PasswordValueObject.invalid();
    }

    return new PasswordValueObject(rawValue);
  }

  private static invalid(): InvalidInputException {
    return new InvalidInputException({
      code: 'AUTH_INVALID_PASSWORD',
      message:
        'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
      details: {
        field: 'password',
      },
    });
  }
}
