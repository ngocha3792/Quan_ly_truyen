import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { InvalidInputException } from '@/common/exceptions';

export interface ParseIsoDatePipeOptions {
  optional?: boolean;
}

export class ParseIsoDatePipe implements PipeTransform<
  unknown,
  Date | undefined
> {
  constructor(private readonly options: ParseIsoDatePipeOptions = {}) {}

  transform(value: unknown, metadata: ArgumentMetadata): Date | undefined {
    const field = metadata.data ?? 'value';

    if (value === undefined || value === null || value === '') {
      if (this.options.optional) {
        return undefined;
      }

      throw new InvalidInputException({
        code: 'DATE_REQUIRED',
        message: `${field} là bắt buộc`,
      });
    }

    if (
      typeof value !== 'string' ||
      !isISO8601(value, {
        strict: true,
        strictSeparator: true,
      })
    ) {
      throw new InvalidInputException({
        code: 'INVALID_ISO_DATE',
        message: `${field} phải là ngày giờ ` + 'ISO-8601 hợp lệ',
      });
    }

    return new Date(value);
  }
}
