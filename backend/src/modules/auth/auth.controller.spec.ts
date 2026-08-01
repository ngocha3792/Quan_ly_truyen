import { IDEMPOTENT_KEY, IS_PUBLIC_KEY } from '@/common/constants';
import type { IdempotencyMetadata } from '@/common/decorators';

import { AuthController } from './auth.controller';

describe('AuthController registration wiring', () => {
  it('makes registration public and requires a 24-hour idempotency key', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'register',
    );
    const handler: unknown = descriptor?.value;
    if (typeof handler !== 'function') {
      throw new Error('Registration handler is not defined');
    }

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(
      Reflect.getMetadata(IDEMPOTENT_KEY, handler) as
        IdempotencyMetadata | undefined,
    ).toEqual({ required: true, ttlSeconds: 86_400 });
  });
});
