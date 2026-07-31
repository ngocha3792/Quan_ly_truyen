import { Transform } from 'class-transformer';

/** Trims a string during class-transformer plain-to-instance conversion. */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
