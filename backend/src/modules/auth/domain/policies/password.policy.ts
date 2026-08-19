import { BCRYPT_MAX_PASSWORD_BYTES } from '@/common/utils';

const LOWERCASE_PATTERN = /[a-z]/;
const UPPERCASE_PATTERN = /[A-Z]/;
const NUMBER_PATTERN = /\d/;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/;

export class PasswordPolicy {
  static readonly MIN_LENGTH = 8;
  static readonly MAX_LENGTH = 72;
  static readonly MAX_BYTES = BCRYPT_MAX_PASSWORD_BYTES;
  static readonly REQUIRE_LOWERCASE = true;
  static readonly REQUIRE_UPPERCASE = true;
  static readonly REQUIRE_NUMBER = true;
  static readonly REQUIRE_SYMBOL = true;

  static isSatisfiedBy(rawValue: string): boolean {
    const byteLength = Buffer.byteLength(rawValue, 'utf8');

    return (
      rawValue.length >= PasswordPolicy.MIN_LENGTH &&
      rawValue.length <= PasswordPolicy.MAX_LENGTH &&
      byteLength <= PasswordPolicy.MAX_BYTES &&
      (!PasswordPolicy.REQUIRE_LOWERCASE || LOWERCASE_PATTERN.test(rawValue)) &&
      (!PasswordPolicy.REQUIRE_UPPERCASE || UPPERCASE_PATTERN.test(rawValue)) &&
      (!PasswordPolicy.REQUIRE_NUMBER || NUMBER_PATTERN.test(rawValue)) &&
      (!PasswordPolicy.REQUIRE_SYMBOL || SYMBOL_PATTERN.test(rawValue))
    );
  }
}
