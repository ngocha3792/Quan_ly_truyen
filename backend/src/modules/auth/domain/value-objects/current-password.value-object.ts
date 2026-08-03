import { BCRYPT_MAX_PASSWORD_BYTES } from '@/common/utils';

import { InvalidCurrentPasswordException } from '../exceptions';

export class CurrentPasswordValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): CurrentPasswordValueObject {
    if (
      typeof rawValue !== 'string' ||
      rawValue.length === 0 ||
      Buffer.byteLength(rawValue, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES
    ) {
      throw new InvalidCurrentPasswordException();
    }

    /*
     * Không trim mật khẩu.
     *
     * Khoảng trắng có thể là một phần của
     * mật khẩu hợp lệ.
     */
    return new CurrentPasswordValueObject(rawValue);
  }
}
