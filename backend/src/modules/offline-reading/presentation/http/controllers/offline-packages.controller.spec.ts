import { IDEMPOTENT_KEY } from '@/common/constants';
import type { IdempotencyMetadata } from '@/common/decorators';

import { OfflinePackagesController } from './offline-packages.controller';

describe('OfflinePackagesController', () => {
  it('requires replay-safe idempotency for package creation', () => {
    const metadata = Reflect.getMetadata(
      IDEMPOTENT_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OfflinePackagesController.prototype.create,
    ) as IdempotencyMetadata | undefined;

    expect(metadata).toEqual({ required: true, ttlSeconds: 86_400 });
  });
});
