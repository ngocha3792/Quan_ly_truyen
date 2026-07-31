import { SetMetadata } from '@nestjs/common';

import { CACHE_TTL_SECONDS_KEY } from '@/common/constants';

/** Declares route cache lifetime in seconds for a cache interceptor. */
export function CacheTtl(seconds: number): MethodDecorator & ClassDecorator {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new TypeError('CacheTtl seconds must be a positive safe integer');
  }

  return SetMetadata(CACHE_TTL_SECONDS_KEY, seconds);
}
