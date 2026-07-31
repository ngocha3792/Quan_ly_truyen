import { ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { InfrastructureException } from './infrastructure.exception';

export class StorageException extends InfrastructureException {
  constructor(options: {
    code?: string;
    message?: string;
    provider?: string;
    operation?: string;
    storageKey?: string;
    details?: ExceptionDetails;
    cause?: unknown;
    retryable?: boolean;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.STORAGE_ERROR,
      message: options.message ?? 'Không thể truy cập dịch vụ lưu trữ',
      component: options.provider ? `storage:${options.provider}` : 'storage',
      operation: options.operation,
      details: {
        ...(options.storageKey ? { storageKey: options.storageKey } : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: options.retryable,
    });
  }
}
