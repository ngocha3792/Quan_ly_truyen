import { Transform } from 'class-transformer';

/** Trims and lowercases an email-like string. Validation remains separate. */
export const NormalizeEmail = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value,
  );
