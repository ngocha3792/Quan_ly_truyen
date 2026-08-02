import { BCRYPT_MAX_PASSWORD_BYTES } from '@/common/utils';

import { InvalidLoginCredentialsException } from '../exceptions';

export class LoginPasswordValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): LoginPasswordValueObject {
    if (
      typeof rawValue !== 'string' ||
      rawValue.length === 0 ||
      Buffer.byteLength(rawValue, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES
    ) {
      throw new InvalidLoginCredentialsException();
    }

    return new LoginPasswordValueObject(rawValue);
  }
}
