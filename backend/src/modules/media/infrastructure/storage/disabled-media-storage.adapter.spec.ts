import { DisabledMediaStorageAdapter } from './disabled-media-storage.adapter';
import { MEDIA_ERROR_CODES } from '../../application/errors/media-error-codes';

describe('DisabledMediaStorageAdapter', () => {
  it('returns a stable non-retryable service-unavailable exception', () => {
    const adapter = new DisabledMediaStorageAdapter();
    try {
      adapter.createSignedUpload();
      fail('expected exception');
    } catch (error: unknown) {
      expect(error).toMatchObject({
        code: MEDIA_ERROR_CODES.STORAGE_DISABLED,
        retryable: false,
      });
    }
  });
});
