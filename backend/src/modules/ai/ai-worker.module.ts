import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { ChaptersModule } from '@/modules/chapters';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AI_CREDENTIAL_VAULT_PORT,
  AI_GATEWAY_PORT,
  AI_PROTOCOL_REGISTRY_PORT,
  AI_POLICY_PERSISTENCE_PORT,
  AI_PROFILE_PERSISTENCE_PORT,
  AI_RATE_LIMIT_PERSISTENCE_PORT,
  AI_USAGE_PERSISTENCE_PORT,
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
  CHAPTER_TRANSLATION_QUEUE_PORT,
} from './application/ports';
import {
  AiConnectionResolver,
  AiResolvedConnectionFactory,
  AiProfileManager,
  AiRateLimiter,
  RequestChapterTranslationCommandHandler,
} from './application';
import {
  AiApiKeyCipherAdapter,
  AiGatewayService,
  AiProtocolRegistry,
  AiTranslationProcessor,
  ChapterTranslationQueueAdapter,
  AnthropicMessagesProtocolAdapter,
  GeminiGenerateContentProtocolAdapter,
  OpenAiChatCompletionsProtocolAdapter,
  OpenAiResponsesProtocolAdapter,
  PrismaAiConnectionPersistence,
  PrismaAiPolicyPersistence,
  PrismaAiProfilePersistence,
  PrismaAiRateLimitPersistence,
  PrismaAiUsagePersistence,
  PrismaChapterTranslationPersistence,
} from './infrastructure';

@Module({
  imports: [PrismaModule, ChaptersModule],
  providers: [
    AiTranslationProcessor,
    PrismaAiConnectionPersistence,
    PrismaAiUsagePersistence,
    PrismaAiPolicyPersistence,
    PrismaAiProfilePersistence,
    PrismaAiRateLimitPersistence,
    PrismaChapterTranslationPersistence,
    AiApiKeyCipherAdapter,
    AiGatewayService,
    AiRateLimiter,
    AiProfileManager,
    AiConnectionResolver,
    AiResolvedConnectionFactory,
    RequestChapterTranslationCommandHandler,
    ChapterTranslationQueueAdapter,
    GeminiGenerateContentProtocolAdapter,
    AnthropicMessagesProtocolAdapter,
    OpenAiResponsesProtocolAdapter,
    OpenAiChatCompletionsProtocolAdapter,
    AiProtocolRegistry,
    {
      provide: AI_CONNECTION_PERSISTENCE_PORT,
      useExisting: PrismaAiConnectionPersistence,
    },
    {
      provide: AI_USAGE_PERSISTENCE_PORT,
      useExisting: PrismaAiUsagePersistence,
    },
    {
      provide: AI_POLICY_PERSISTENCE_PORT,
      useExisting: PrismaAiPolicyPersistence,
    },
    {
      provide: AI_PROFILE_PERSISTENCE_PORT,
      useExisting: PrismaAiProfilePersistence,
    },
    {
      provide: AI_RATE_LIMIT_PERSISTENCE_PORT,
      useExisting: PrismaAiRateLimitPersistence,
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
      provide: AI_PROTOCOL_REGISTRY_PORT,
      useExisting: AiProtocolRegistry,
    },
    {
      provide: CHAPTER_TRANSLATION_PERSISTENCE_PORT,
      useExisting: PrismaChapterTranslationPersistence,
    },
    {
      provide: CHAPTER_TRANSLATION_QUEUE_PORT,
      useExisting: ChapterTranslationQueueAdapter,
    },
  ],
})
export class AiWorkerModule {}
