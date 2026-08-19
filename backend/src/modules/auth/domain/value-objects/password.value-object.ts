import { InvalidInputException } from '@/common/exceptions';
import { PasswordPolicy } from '../policies';

export class PasswordValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): PasswordValueObject {
    if (typeof rawValue !== 'string') {
      throw PasswordValueObject.invalid();
    }

    if (!PasswordPolicy.isSatisfiedBy(rawValue)) {
      throw PasswordValueObject.invalid();
    }

    return new PasswordValueObject(rawValue);
  }

  private static invalid(): InvalidInputException {
    return new InvalidInputException({
      code: 'AUTH_INVALID_PASSWORD',
      message: `Mật khẩu phải có từ ${PasswordPolicy.MIN_LENGTH} đến ${PasswordPolicy.MAX_LENGTH} ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt`,
      details: {
        field: 'password',
      },
    });
  }
}
