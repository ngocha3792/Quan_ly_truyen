import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiAuthType, AiProtocol } from '../../domain/enums';

export enum AiConnectionPresetId {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  OPENAI_COMPATIBLE = 'OPENAI_COMPATIBLE',
}

export interface ResolvedAiConnectionPreset {
  readonly vendorHint: string;
  readonly protocol: AiProtocol;
  readonly authType: AiAuthType;
  readonly authHeaderName: string | null;
  readonly baseUrl: string;
}

export function resolveAiConnectionPreset(
  presetId: AiConnectionPresetId,
  customBaseUrl: string | null,
  defaultModel: string | null,
): ResolvedAiConnectionPreset {
  switch (presetId) {
    case AiConnectionPresetId.GEMINI:
      return {
        vendorHint: presetId,
        protocol: AiProtocol.GEMINI_GENERATE_CONTENT,
        authType: AiAuthType.QUERY_PARAM,
        authHeaderName: 'key',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      };
    case AiConnectionPresetId.OPENAI:
      return {
        vendorHint: presetId,
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        authType: AiAuthType.BEARER,
        authHeaderName: null,
        baseUrl: 'https://api.openai.com/v1',
      };
    case AiConnectionPresetId.ANTHROPIC:
      return {
        vendorHint: presetId,
        protocol: AiProtocol.ANTHROPIC_MESSAGES,
        authType: AiAuthType.X_API_KEY,
        authHeaderName: 'x-api-key',
        baseUrl: 'https://api.anthropic.com/v1',
      };
    case AiConnectionPresetId.OPENAI_COMPATIBLE:
      if (!customBaseUrl || !defaultModel) {
        throw new BusinessRuleViolationException({
          message:
            'Kết nối OpenAI Compatible cần khai báo Base URL và Model mặc định.',
          rule: 'ai-connection.compatible-requires-base-url-and-model',
        });
      }
      return {
        vendorHint: presetId,
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        authType: AiAuthType.BEARER,
        authHeaderName: null,
        baseUrl: customBaseUrl,
      };
  }
}
