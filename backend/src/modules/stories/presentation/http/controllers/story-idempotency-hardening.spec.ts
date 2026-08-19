import { IDEMPOTENT_KEY } from '@/common/constants';
import type { IdempotencyMetadata } from '@/common/decorators';
import { AuthorStoriesController } from './author-stories.controller';

const EXPECTED = {
  required: true,
  ttlSeconds: 86_400,
} satisfies IdempotencyMetadata;

describe('Stories HTTP idempotency hardening', () => {
  it('create story requires an idempotency key', () => {
    expect(
      readMetadata(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        AuthorStoriesController.prototype.create,
      ),
    ).toEqual(EXPECTED);
  });
});

function readMetadata(
  target: (...args: never[]) => unknown,
): IdempotencyMetadata | undefined {
  return Reflect.getMetadata(IDEMPOTENT_KEY, target) as
    IdempotencyMetadata | undefined;
}
