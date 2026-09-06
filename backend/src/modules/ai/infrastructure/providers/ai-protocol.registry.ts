import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BusinessRuleViolationException } from '@/common/exceptions';
import type { AiConfig } from '@/config';

import { AiProtocol } from '../../domain/enums';
import type {
  AiProtocolAdapter,
  AiProtocolRegistryPort,
} from '../../application/ports';
import { AnthropicMessagesProtocolAdapter } from './anthropic-provider.adapter';
import { GeminiGenerateContentProtocolAdapter } from './gemini-provider.adapter';
import { OpenAiChatCompletionsProtocolAdapter } from './openai-compatible-provider.adapter';

@Injectable()
export class AiProtocolRegistry implements AiProtocolRegistryPort {
  private readonly adapters: Partial<Record<AiProtocol, AiProtocolAdapter>>;
  private readonly defaultModels: Readonly<Record<AiProtocol, string>>;

  constructor(
    configService: ConfigService,
    openAiChatCompletions: OpenAiChatCompletionsProtocolAdapter,
    anthropicMessages: AnthropicMessagesProtocolAdapter,
    geminiGenerateContent: GeminiGenerateContentProtocolAdapter,
  ) {
    const config = configService.getOrThrow<AiConfig>('ai');

    this.adapters = {
      [AiProtocol.OPENAI_CHAT_COMPLETIONS]: openAiChatCompletions,
      [AiProtocol.ANTHROPIC_MESSAGES]: anthropicMessages,
      [AiProtocol.GEMINI_GENERATE_CONTENT]: geminiGenerateContent,
    };

    this.defaultModels = {
      [AiProtocol.OPENAI_RESPONSES]: config.openai.model,
      [AiProtocol.OPENAI_CHAT_COMPLETIONS]: config.openai.model,
      [AiProtocol.ANTHROPIC_MESSAGES]: config.anthropic.model,
      [AiProtocol.GEMINI_GENERATE_CONTENT]: config.gemini.model,
    };
  }

  getAdapter(protocol: AiProtocol): AiProtocolAdapter {
    const adapter = this.adapters[protocol];
    if (!adapter) {
      throw new BusinessRuleViolationException({
        message: `Protocol AI ${protocol} chưa được hỗ trợ.`,
        rule: 'ai-connection.protocol-unsupported',
      });
    }
    return adapter;
  }

  getDefaultModel(protocol: AiProtocol): string {
    return this.defaultModels[protocol];
  }
}
