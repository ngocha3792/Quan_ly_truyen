import { InvalidLoginCredentialsException } from '../exceptions';

export class LoginIdentifierValueObject {
  private constructor(readonly value: string) {}

  static create(rawValue: string): LoginIdentifierValueObject {
    if (typeof rawValue !== 'string') {
      throw new InvalidLoginCredentialsException();
    }

    const normalizedValue = rawValue.trim().toLowerCase();

    if (normalizedValue.length < 3 || normalizedValue.length > 320) {
      throw new InvalidLoginCredentialsException();
    }

    return new LoginIdentifierValueObject(normalizedValue);
  }

  toString(): string {
    return this.value;
  }
}
