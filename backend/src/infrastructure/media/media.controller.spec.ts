import { IDEMPOTENT_KEY } from '@/common/constants';
import type { IdempotencyMetadata } from '@/common/decorators';

import { MediaController } from './media.controller';

describe('MediaController idempotency wiring', () => {
  it('requires an idempotency key for upload-intent creation', () => {
    const metadata = Reflect.getMetadata(
      IDEMPOTENT_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      MediaController.prototype.createIntent,
    ) as IdempotencyMetadata | undefined;

    expect(metadata).toEqual({ required: true });
  });
});
