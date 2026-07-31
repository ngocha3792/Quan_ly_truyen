import { ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { InfrastructureException } from './infrastructure.exception';

export class QueueException extends InfrastructureException {
  constructor(options: {
    code?: string;
    message?: string;
    queue?: string;
    operation?: string;
    jobId?: string;
    details?: ExceptionDetails;
    cause?: unknown;
    retryable?: boolean;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.QUEUE_ERROR,
      message: options.message ?? 'Không thể xử lý hàng đợi',
      component: options.queue ? `queue:${options.queue}` : 'queue',
      operation: options.operation,
      details: {
        ...(options.jobId ? { jobId: options.jobId } : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: options.retryable,
    });
  }
}
