import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AiConfig } from '@/config';
import { AiProvider } from '@/generated/prisma/client';

import { AiProviderClientPort } from '../../application/ports/ai-provider-client.port';
import { AnthropicProviderAdapter } from './anthropic-provider.adapter';
import { GeminiProviderAdapter } from './gemini-provider.adapter';
import { OpenAiProviderAdapter } from './openai-provider.adapter';

@Injectable()
export class AiProviderRegistry {
  private readonly clients: Record<AiProvider, AiProviderClientPort>;
  private readonly models: Record<AiProvider, string>;

  constructor(
    configService: ConfigService,
    gemini: GeminiProviderAdapter,
    openai: OpenAiProviderAdapter,
    anthropic: AnthropicProviderAdapter,
  ) {
    const config = configService.getOrThrow<AiConfig>('ai');

    this.clients = {
      [AiProvider.GEMINI]: gemini,
      [AiProvider.OPENAI]: openai,
      [AiProvider.ANTHROPIC]: anthropic,
    };

    this.models = {
      [AiProvider.GEMINI]: config.gemini.model,
      [AiProvider.OPENAI]: config.openai.model,
      [AiProvider.ANTHROPIC]: config.anthropic.model,
    };
  }

  getClient(provider: AiProvider): AiProviderClientPort {
    return this.clients[provider];
  }

  getModel(provider: AiProvider): string {
    return this.models[provider];
  }
}
