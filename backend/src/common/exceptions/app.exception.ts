import { ExceptionCategory } from './exception-category.enum';

export type ExceptionDetails = Readonly<Record<string, unknown>>;

export interface AppExceptionOptions {
  code: string;
  message: string;
  category: ExceptionCategory;
  details?: ExceptionDetails;
  cause?: unknown;
  retryable?: boolean;
  /** Whether the public API may expose the supplied message/details. */
  expose?: boolean;
}

export interface SerializedAppException {
  name: string;
  code: string;
  message: string;
  category: ExceptionCategory;
  details?: ExceptionDetails;
  retryable: boolean;
  expose: boolean;
  occurredAt: string;
}

/**
 * Base error for domain/application/infrastructure failures.
 * It intentionally has no dependency on NestJS, HTTP, Prisma, or a queue SDK.
 */
export abstract class AppException extends Error {
  readonly code: string;
  readonly category: ExceptionCategory;
  readonly details?: ExceptionDetails;
  readonly cause?: unknown;
  readonly retryable: boolean;
  readonly expose: boolean;
  readonly occurredAt: Date;

  protected constructor(options: AppExceptionOptions) {
    super(options.message);

    this.name = new.target.name;
    this.code = options.code;
    this.category = options.category;
    this.details = options.details;
    this.cause = options.cause;
    this.retryable = options.retryable ?? false;
    this.expose = options.expose ?? true;
    this.occurredAt = new Date();

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): SerializedAppException {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      ...(this.details ? { details: this.details } : {}),
      retryable: this.retryable,
      expose: this.expose,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}

export function isAppException(error: unknown): error is AppException {
  return error instanceof AppException;
}
