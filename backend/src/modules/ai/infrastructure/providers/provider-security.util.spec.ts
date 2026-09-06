import { AiErrorCode } from '../../domain/enums';
import {
  sanitizeProviderErrorMessage,
  toProviderTransportError,
} from './provider-error.util';
import { resolveProviderTimeoutMs } from './provider-request-timeout.util';

describe('provider security utilities', () => {
  it('không đưa query credential từ fetch error ra ngoài', () => {
    const error = toProviderTransportError(
      new TypeError('fetch failed for https://ai.test/models?key=top-secret'),
      'AI gateway',
    );

    expect(error.message).toBe('Không thể kết nối tới AI gateway.');
    expect(error).toMatchObject({ code: AiErrorCode.PROVIDER_UNAVAILABLE });
  });

  it('redact credential trong provider error payload', () => {
    expect(
      sanitizeProviderErrorMessage(
        'Invalid api_key=top-secret at https://ai.example/v1?key=top-secret',
        'top-secret',
        'Provider error',
      ),
    ).not.toContain('top-secret');
  });

  it('clamp timeout theo hard maximum', () => {
    expect(resolveProviderTimeoutMs(900_000, 30_000, 600_000)).toBe(600_000);
    expect(resolveProviderTimeoutMs(-1, 30_000, 600_000)).toBe(30_000);
  });
});
