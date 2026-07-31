import { Transform } from 'class-transformer';

/** Converts a blank string to undefined before validation. */
export const EmptyStringToUndefined = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : value;
  });
