import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiAuthType, AiProtocol } from '../../domain/enums';
import {
  AiConnectionPresetId,
  resolveAiConnectionPreset,
} from './ai-connection-presets';

describe('resolveAiConnectionPreset compatible APIs', () => {
  it('tạo Anthropic-compatible preset mặc định x-api-key', () => {
    expect(
      resolveAiConnectionPreset(
        AiConnectionPresetId.ANTHROPIC_COMPATIBLE,
        'https://1gw.gwai.cloud',
        'claude-sonnet-5',
      ),
    ).toEqual({
      vendorHint: 'ANTHROPIC_COMPATIBLE',
      protocol: AiProtocol.ANTHROPIC_MESSAGES,
      authType: AiAuthType.X_API_KEY,
      authHeaderName: 'x-api-key',
      baseUrl: 'https://1gw.gwai.cloud',
    });
  });

  it('cho phép OpenAI-compatible dùng custom header auth', () => {
    expect(
      resolveAiConnectionPreset(
        AiConnectionPresetId.OPENAI_COMPATIBLE,
        'https://proxy.example.com/v1',
        'deepseek-v3',
        AiAuthType.API_KEY_HEADER,
        'X-Token',
      ),
    ).toMatchObject({
      protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      authType: AiAuthType.API_KEY_HEADER,
      authHeaderName: 'X-Token',
    });
  });

  it('từ chối compatible connection thiếu base URL hoặc model', () => {
    expect(() =>
      resolveAiConnectionPreset(
        AiConnectionPresetId.ANTHROPIC_COMPATIBLE,
        null,
        'model',
      ),
    ).toThrow(BusinessRuleViolationException);
  });
});
