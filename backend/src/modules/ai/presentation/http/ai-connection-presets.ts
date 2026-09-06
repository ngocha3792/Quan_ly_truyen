import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiAuthType, AiProtocol } from '../../domain/enums';
import { normalizeAiAuthHeaderName } from '../../domain/value-objects';

export enum AiConnectionPresetId {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  OPENAI_COMPATIBLE = 'OPENAI_COMPATIBLE',
  ANTHROPIC_COMPATIBLE = 'ANTHROPIC_COMPATIBLE',
  CUSTOM = 'CUSTOM',
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
  customAuthType?: AiAuthType,
  customAuthHeaderName?: string | null,
  customProtocol?: AiProtocol,
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
        protocol: AiProtocol.OPENAI_RESPONSES,
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
    case AiConnectionPresetId.ANTHROPIC_COMPATIBLE: {
      if (!customBaseUrl || !defaultModel) {
        throw new BusinessRuleViolationException({
          message:
            'Kết nối compatible cần khai báo Base URL và Model mặc định.',
          rule: 'ai-connection.compatible-requires-base-url-and-model',
        });
      }

      const protocol =
        presetId === AiConnectionPresetId.ANTHROPIC_COMPATIBLE
          ? AiProtocol.ANTHROPIC_MESSAGES
          : AiProtocol.OPENAI_CHAT_COMPLETIONS;
      const authType =
        customAuthType ??
        (protocol === AiProtocol.ANTHROPIC_MESSAGES
          ? AiAuthType.X_API_KEY
          : AiAuthType.BEARER);

      return {
        vendorHint: presetId,
        protocol,
        authType,
        authHeaderName: normalizeAiAuthHeaderName(
          authType,
          customAuthHeaderName,
        ),
        baseUrl: customBaseUrl,
      };
    }
    case AiConnectionPresetId.CUSTOM: {
      if (
        !customBaseUrl ||
        !defaultModel ||
        !customProtocol ||
        !customAuthType
      ) {
        throw new BusinessRuleViolationException({
          message:
            'Custom gateway cần khai báo Base URL, Protocol, Auth type và Model mặc định.',
          rule: 'ai-connection.custom-requires-advanced-settings',
        });
      }

      const authHeaderName = normalizeAiAuthHeaderName(
        customAuthType,
        customAuthHeaderName,
      );
      if (customAuthType === AiAuthType.API_KEY_HEADER && !authHeaderName) {
        throw new BusinessRuleViolationException({
          message: 'Custom header auth cần khai báo tên header.',
          rule: 'ai-connection.custom-header-name-required',
        });
      }

      return {
        vendorHint: AiConnectionPresetId.CUSTOM,
        protocol: customProtocol,
        authType: customAuthType,
        authHeaderName,
        baseUrl: customBaseUrl,
      };
    }
  }
}
