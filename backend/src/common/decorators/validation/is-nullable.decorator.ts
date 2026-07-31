import { ValidateIf } from 'class-validator';

/**
 * Skips following class-validator decorators only when the value is null.
 * Unlike IsOptional(), undefined is still validated.
 */
export const IsNullable = (): PropertyDecorator =>
  ValidateIf((_object: object, value: unknown) => value !== null);
