import {
  AI_MAX_RESPONSE_BYTES,
  assertPublicHttpsUrl,
  readBodyWithLimit,
  safeExternalFetch,
} from './ssrf-guard.util';

describe('AI SSRF guard', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    'https://127.0.0.1/v1',
    'https://100.64.0.1/v1',
    'https://198.18.0.1/v1',
    'https://[::1]/v1',
    'https://[::ffff:127.0.0.1]/v1',
    'https://service.internal/v1',
  ])('chặn địa chỉ nội bộ hoặc special-use: %s', async (url) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toMatchObject({
      details: { rule: 'ai-connection.base-url-private-network' },
    });
  });

  it('revalidate URL cuối ngay trước fetch và không gửi request private', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      safeExternalFetch('https://127.0.0.1/v1/models?key=secret', {}),
    ).rejects.toMatchObject({
      details: { rule: 'ai-connection.base-url-private-network' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('giới hạn body theo byte kể cả không có Content-Length', async () => {
    const response = new Response('x'.repeat(AI_MAX_RESPONSE_BYTES + 1));

    await expect(readBodyWithLimit(response)).rejects.toMatchObject({
      details: { rule: 'ai-connection.response-too-large' },
    });
  });
});
