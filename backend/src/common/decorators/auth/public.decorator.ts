import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '@/common/constants';

/**
 * Marks a controller or route as accessible without an authenticated user.
 * The global authentication guard must read IS_PUBLIC_KEY with Reflector.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
