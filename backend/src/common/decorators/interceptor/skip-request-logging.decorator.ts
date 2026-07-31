import { SetMetadata } from '@nestjs/common';

import { SKIP_REQUEST_LOGGING_KEY } from '@/common/constants';

/** Disables the common request logging interceptor for a route/controller. */
export const SkipRequestLogging = (): MethodDecorator | ClassDecorator =>
  SetMetadata(SKIP_REQUEST_LOGGING_KEY, true);
