import { SetMetadata } from '@nestjs/common';

import { SKIP_REQUEST_TIMEOUT_KEY } from '@/common/constants';

/** Disables the common request timeout interceptor. Useful for SSE/streams. */
export const SkipRequestTimeout = (): MethodDecorator | ClassDecorator =>
  SetMetadata(SKIP_REQUEST_TIMEOUT_KEY, true);
