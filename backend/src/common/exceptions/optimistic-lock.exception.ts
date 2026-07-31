import { AppException } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class OptimisticLockException extends AppException {
  constructor(options: {
    resource: string;
    identifier: unknown;
    expectedVersion: number;
    actualVersion?: number;
  }) {
    super({
      code: CommonExceptionCode.OPTIMISTIC_LOCK_CONFLICT,
      message: 'Phiên bản dữ liệu không còn hợp lệ, vui lòng tải lại',
      category: ExceptionCategory.CONFLICT,
      details: {
        resource: options.resource,
        identifier: options.identifier,
        expectedVersion: options.expectedVersion,
        ...(options.actualVersion !== undefined
          ? { actualVersion: options.actualVersion }
          : {}),
      },
      retryable: true,
    });
  }
}
