import { AppException } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class IdempotencyConflictException extends AppException {
  constructor(options: {
    key: string;
    message?: string;
    existingRequestHash?: string;
    currentRequestHash?: string;
  }) {
    super({
      code: CommonExceptionCode.IDEMPOTENCY_CONFLICT,
      message:
        options.message ??
        'Idempotency key đã được sử dụng cho một request khác',
      category: ExceptionCategory.CONFLICT,
      details: {
        key: options.key,
        ...(options.existingRequestHash
          ? { existingRequestHash: options.existingRequestHash }
          : {}),
        ...(options.currentRequestHash
          ? { currentRequestHash: options.currentRequestHash }
          : {}),
      },
    });
  }
}
