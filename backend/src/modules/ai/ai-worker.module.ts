import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AI_CREDENTIAL_VAULT_PORT,
  AI_GATEWAY_PORT,
  AI_USAGE_PERSISTENCE_PORT,
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
} from './application/ports';
import {
  AiApiKeyCipherAdapter,
  AiGatewayService,
  AiProviderRegistry,
  AiTranslationProcessor,
  AnthropicProviderAdapter,
  GeminiProviderAdapter,
  OpenAiCompatibleProviderAdapter,
  OpenAiProviderAdapter,
  PrismaAiConnectionPersistence,
  PrismaAiUsagePersistence,
  PrismaChapterTranslationPersistence,
} from './infrastructure';

@Module({
  imports: [PrismaModule],
  providers: [
    AiTranslationProcessor,
    PrismaAiConnectionPersistence,
    PrismaAiUsagePersistence,
    PrismaChapterTranslationPersistence,
    AiApiKeyCipherAdapter,
    AiGatewayService,
    GeminiProviderAdapter,
    OpenAiProviderAdapter,
    AnthropicProviderAdapter,
    OpenAiCompatibleProviderAdapter,
    AiProviderRegistry,
    {
      provide: AI_CONNECTION_PERSISTENCE_PORT,
      useExisting: PrismaAiConnectionPersistence,
    },
    {
      provide: AI_USAGE_PERSISTENCE_PORT,
      useExisting: PrismaAiUsagePersistence,
    },
    {
      provide: AI_CREDENTIAL_VAULT_PORT,
      useExisting: AiApiKeyCipherAdapter,
    },
    {
      provide: AI_GATEWAY_PORT,
      useExisting: AiGatewayService,
    },
    {
      provide: CHAPTER_TRANSLATION_PERSISTENCE_PORT,
      useExisting: PrismaChapterTranslationPersistence,
    },
  ],
})
export class AiWorkerModule {}
