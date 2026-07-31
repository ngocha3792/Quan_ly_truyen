import { SetMetadata } from '@nestjs/common';

import { REQUEST_TIMEOUT_MS_KEY } from '@/common/constants';

/** Overrides the global HTTP timeout for one controller or route. */
export function RequestTimeout(
  milliseconds: number,
): MethodDecorator & ClassDecorator {
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new TypeError(
      'RequestTimeout milliseconds must be a positive safe integer',
    );
  }

  return SetMetadata(REQUEST_TIMEOUT_MS_KEY, milliseconds);
}
