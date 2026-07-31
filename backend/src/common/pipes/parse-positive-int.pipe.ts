import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { InvalidInputException } from '@/common/exceptions';

export interface ParsePositiveIntPipeOptions {
  optional?: boolean;
  defaultValue?: number;
  min?: number;
  max?: number;
}

export class ParsePositiveIntPipe implements PipeTransform<
  unknown,
  number | undefined
> {
  constructor(private readonly options: ParsePositiveIntPipeOptions = {}) {}

  transform(value: unknown, metadata: ArgumentMetadata): number | undefined {
    const field = metadata.data ?? 'value';

    const isMissing = value === undefined || value === null || value === '';

    if (isMissing) {
      if (this.options.defaultValue !== undefined) {
        return this.validateNumber(this.options.defaultValue, field);
      }

      if (this.options.optional) {
        return undefined;
      }

      throw new InvalidInputException({
        code: 'INTEGER_REQUIRED',
        message: `${field} là bắt buộc`,
      });
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      throw this.invalidIntegerException(field);
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed)) {
      throw this.invalidIntegerException(field);
    }

    return this.validateNumber(parsed, field);
  }

  private validateNumber(value: number, field: string): number {
    const min = this.options.min ?? 1;

    const max = this.options.max ?? Number.MAX_SAFE_INTEGER;

    if (value < min || value > max) {
      throw new InvalidInputException({
        code: 'INTEGER_OUT_OF_RANGE',
        message: `${field} phải nằm trong khoảng ` + `${min} đến ${max}`,
      });
    }

    return value;
  }

  private invalidIntegerException(field: string): InvalidInputException {
    return new InvalidInputException({
      code: 'INVALID_INTEGER',
      message: `${field} phải là số nguyên`,
    });
  }
}
