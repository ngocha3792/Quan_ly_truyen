import { SetMetadata } from '@nestjs/common';

import { SKIP_RESPONSE_ENVELOPE_KEY } from '@/common/constants';

/** Prevents ResponseEnvelopeInterceptor from wrapping a route response. */
export const SkipResponseEnvelope = (): MethodDecorator | ClassDecorator =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE_KEY, true);
