import { assertWorkerCapabilities } from './worker-preflight';

describe('assertWorkerCapabilities', () => {
  it('rejects a queue worker when queue capability is disabled', () => {
    expect(() =>
      assertWorkerCapabilities({
        role: 'queue',
        queueActive: false,
        cloudinaryActive: true,
      }),
    ).toThrow(
      'WORKER_ROLE=queue requires QUEUE_ENABLED=true and REDIS_ENABLED=true',
    );
  });

  it('rejects a Cloudinary worker when Cloudinary is disabled', () => {
    expect(() =>
      assertWorkerCapabilities({
        role: 'cloudinary-webhook',
        queueActive: true,
        cloudinaryActive: false,
      }),
    ).toThrow(
      'WORKER_ROLE=cloudinary-webhook requires CLOUDINARY_ENABLED=true',
    );
  });

  it('rejects an all-role worker with no active capability', () => {
    expect(() =>
      assertWorkerCapabilities({
        role: 'all',
        queueActive: false,
        cloudinaryActive: false,
      }),
    ).toThrow('WORKER_ROLE=all requires at least one active');
  });

  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    'allows all-role when queue=%s and cloudinary=%s',
    (queueActive, cloudinaryActive) => {
      expect(() =>
        assertWorkerCapabilities({
          role: 'all',
          queueActive,
          cloudinaryActive,
        }),
      ).not.toThrow();
    },
  );
});
