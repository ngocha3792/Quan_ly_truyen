import { SetMetadata } from '@nestjs/common';

import { IDEMPOTENT_KEY } from '@/common/constants';

export interface IdempotentOptions {
  /** Whether the Idempotency-Key header is mandatory. Defaults to true. */
  required?: boolean;

  /** How long a completed result may be replayed, in seconds. */
  ttlSeconds?: number;
}

export interface IdempotencyMetadata {
  required: boolean;
  ttlSeconds?: number;
}

/**
 * Marks a command endpoint as idempotent. An IdempotencyInterceptor must read
 * this metadata and use an atomic store such as Redis or PostgreSQL.
 */
export function Idempotent(
  options: IdempotentOptions = {},
): MethodDecorator & ClassDecorator {
  if (
    options.ttlSeconds !== undefined &&
    (!Number.isSafeInteger(options.ttlSeconds) ||
      options.ttlSeconds <= 0)
  ) {
    throw new TypeError(
      'Idempotent ttlSeconds must be a positive safe integer',
    );
  }

  const metadata: IdempotencyMetadata = {
    required: options.required ?? true,
    ...(options.ttlSeconds === undefined
      ? {}
      : { ttlSeconds: options.ttlSeconds }),
  };

  return SetMetadata(IDEMPOTENT_KEY, metadata);
}
