import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiAuthType, AiProtocol } from '../../domain/enums';
import type { ResolvedAiConnection } from '../../application/ports';
import { applyAiCredential } from './ai-auth.util';

function connection(
  authType: AiAuthType,
  authHeaderName: string | null = null,
): ResolvedAiConnection {
  return {
    protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
    vendorHint: null,
    baseUrl: 'https://ai.example.com/v1',
    authType,
    authHeaderName,
    credential: 'secret-value',
    model: 'test-model',
  };
}

describe('applyAiCredential', () => {
  it('gắn Bearer token mà không làm mất header ban đầu', () => {
    const result = applyAiCredential(
      connection(AiAuthType.BEARER),
      'https://ai.example.com/v1/models',
      { Accept: 'application/json' },
    );

    expect(result.headers.get('Authorization')).toBe('Bearer secret-value');
    expect(result.headers.get('Accept')).toBe('application/json');
  });

  it('gắn x-api-key cho protocol dùng header chuẩn này', () => {
    const result = applyAiCredential(
      connection(AiAuthType.X_API_KEY),
      'https://ai.example.com/v1/models',
    );

    expect(result.headers.get('x-api-key')).toBe('secret-value');
  });

  it('hỗ trợ tên API key header do connection cấu hình', () => {
    const result = applyAiCredential(
      connection(AiAuthType.API_KEY_HEADER, 'X-Custom-Token'),
      'https://ai.example.com/v1/models',
    );

    expect(result.headers.get('X-Custom-Token')).toBe('secret-value');
  });

  it('hỗ trợ API key trong query parameter và giữ query hiện có', () => {
    const result = applyAiCredential(
      connection(AiAuthType.QUERY_PARAM, 'api_key'),
      'https://ai.example.com/v1/models?alt=sse',
    );
    const url = new URL(result.url);

    expect(url.searchParams.get('alt')).toBe('sse');
    expect(url.searchParams.get('api_key')).toBe('secret-value');
  });

  it('chặn auth header có thể can thiệp routing HTTP', () => {
    expect(() =>
      applyAiCredential(
        connection(AiAuthType.API_KEY_HEADER, 'Host'),
        'https://ai.example.com/v1/models',
      ),
    ).toThrow(BusinessRuleViolationException);
  });

  it.each([
    'Content-Length',
    'Transfer-Encoding',
    'X-Forwarded-Host',
    'Cookie',
  ])('chặn custom auth header nguy hiểm: %s', (header) => {
    expect(() =>
      applyAiCredential(
        connection(AiAuthType.API_KEY_HEADER, header),
        'https://ai.example.com/v1/models',
      ),
    ).toThrow(BusinessRuleViolationException);
  });

  it('chặn tên query parameter chứa ký tự dành riêng', () => {
    expect(() =>
      applyAiCredential(
        connection(AiAuthType.QUERY_PARAM, 'key#fragment'),
        'https://ai.example.com/v1/models',
      ),
    ).toThrow(BusinessRuleViolationException);
  });
});
