import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export interface StrongPasswordOptions {
  minLength?: number;
  maxLength?: number;
  requireLowercase?: boolean;
  requireUppercase?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
}

const DEFAULT_OPTIONS: Required<StrongPasswordOptions> = {
  minLength: 8,
  maxLength: 72,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
};

function resolveOptions(
  options: StrongPasswordOptions,
): Required<StrongPasswordOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

/**
 * Password validator aligned with the bcrypt 72-byte policy. Byte-length is
 * checked later by bcrypt.util.ts; this decorator checks character rules.
 */
export function IsStrongPassword(
  options: StrongPasswordOptions = {},
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  const resolved = resolveOptions(options);

  if (
    !Number.isSafeInteger(resolved.minLength) ||
    !Number.isSafeInteger(resolved.maxLength) ||
    resolved.minLength <= 0 ||
    resolved.maxLength < resolved.minLength
  ) {
    throw new TypeError(
      'Invalid strong-password length configuration',
    );
  }

  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isStrongPassword',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [resolved],
      ...(validationOptions === undefined
        ? {}
        : { options: validationOptions }),
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }

          if (
            value.length < resolved.minLength ||
            value.length > resolved.maxLength
          ) {
            return false;
          }

          return (
            (!resolved.requireLowercase || /[a-z]/.test(value)) &&
            (!resolved.requireUppercase || /[A-Z]/.test(value)) &&
            (!resolved.requireNumber || /\d/.test(value)) &&
            (!resolved.requireSymbol || /[^A-Za-z0-9]/.test(value))
          );
        },
        defaultMessage(
          args: ValidationArguments,
        ): string {
          return `${args.property} does not meet the password policy`;
        },
      },
    });
  };
}
