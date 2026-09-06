import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { CacheModule } from '@/infrastructure/cache';
import { AuthAuthorizationModule } from '@/modules/auth';
import { AuthorsModule } from '@/modules/authors';
import { ChaptersModule } from '@/modules/chapters';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AI_CONVERSATION_PERSISTENCE_PORT,
  AI_CREDENTIAL_VAULT_PORT,
  AI_GATEWAY_PORT,
  AI_MODEL_CACHE_PORT,
  AI_PROTOCOL_REGISTRY_PORT,
  AI_POLICY_PERSISTENCE_PORT,
  AI_PROFILE_PERSISTENCE_PORT,
  AI_RATE_LIMIT_PERSISTENCE_PORT,
  AI_SECURITY_AUDIT_PORT,
  AI_USAGE_PERSISTENCE_PORT,
  AiPolicyManager,
  AiProfileManager,
  AiRateLimiter,
  AiChatContextBuilder,
  AiConnectionResolver,
  AiResolvedConnectionFactory,
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
  CHAPTER_TRANSLATION_QUEUE_PORT,
  CreateAiConnectionCommandHandler,
  CreateAiConversationCommandHandler,
  DeleteAiConnectionCommandHandler,
  DeleteAiConversationCommandHandler,
  GetAiConversationQueryHandler,
  GetChapterTranslationQueryHandler,
  ListAiConnectionModelsQueryHandler,
  ListAiConnectionsQueryHandler,
  ListAiConversationsQueryHandler,
  ProbeAiConnectionCapabilitiesCommandHandler,
  RequestChapterTranslationCommandHandler,
  SendAiMessageCommandHandler,
  SendAiMessageStreamCommandHandler,
  TestAiConnectionCommandHandler,
  UpdateAiConnectionCommandHandler,
} from './application';
import {
  AiApiKeyCipherAdapter,
  AiGatewayService,
  AiModelCacheAdapter,
  AiProtocolRegistry,
  AnthropicMessagesProtocolAdapter,
  ChapterTranslationQueueAdapter,
  GeminiGenerateContentProtocolAdapter,
  OpenAiChatCompletionsProtocolAdapter,
  OpenAiResponsesProtocolAdapter,
  PrismaAiConnectionPersistence,
  PrismaAiConversationPersistence,
  PrismaAiPolicyPersistence,
  PrismaAiProfilePersistence,
  PrismaAiRateLimitPersistence,
  PrismaAiSecurityAuditAdapter,
  PrismaAiUsagePersistence,
  PrismaChapterTranslationPersistence,
} from './infrastructure';
import {
  AdminAiConnectionsController,
  AdminAiPolicyController,
  AiChatController,
  AiConnectionsController,
  AiPolicyController,
  AiProfileController,
  AiStoryProfileController,
  ChapterTranslationsController,
} from './presentation/http';

const portProviders = [
  {
    provide: AI_CONNECTION_PERSISTENCE_PORT,
    useExisting: PrismaAiConnectionPersistence,
  },
  {
    provide: AI_CONVERSATION_PERSISTENCE_PORT,
    useExisting: PrismaAiConversationPersistence,
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
    provide: AI_MODEL_CACHE_PORT,
    useExisting: AiModelCacheAdapter,
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
    provide: AI_SECURITY_AUDIT_PORT,
    useExisting: PrismaAiSecurityAuditAdapter,
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
];

const applicationHandlers = [
  CreateAiConnectionCommandHandler,
  UpdateAiConnectionCommandHandler,
  DeleteAiConnectionCommandHandler,
  TestAiConnectionCommandHandler,
  ProbeAiConnectionCapabilitiesCommandHandler,
  ListAiConnectionsQueryHandler,
  ListAiConnectionModelsQueryHandler,
  CreateAiConversationCommandHandler,
  DeleteAiConversationCommandHandler,
  ListAiConversationsQueryHandler,
  GetAiConversationQueryHandler,
  SendAiMessageCommandHandler,
  SendAiMessageStreamCommandHandler,
  RequestChapterTranslationCommandHandler,
  GetChapterTranslationQueryHandler,
];

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    AuthAuthorizationModule,
    ChaptersModule,
    AuthorsModule,
  ],
  controllers: [
    AdminAiConnectionsController,
    AdminAiPolicyController,
    AiConnectionsController,
    AiPolicyController,
    AiProfileController,
    AiStoryProfileController,
    AiChatController,
    ChapterTranslationsController,
  ],
  providers: [
    PrismaAiConnectionPersistence,
    PrismaAiConversationPersistence,
    PrismaAiUsagePersistence,
    PrismaAiPolicyPersistence,
    PrismaAiProfilePersistence,
    PrismaAiRateLimitPersistence,
    PrismaAiSecurityAuditAdapter,
    PrismaChapterTranslationPersistence,
    AiApiKeyCipherAdapter,
    AiGatewayService,
    AiModelCacheAdapter,
    AiPolicyManager,
    AiProfileManager,
    AiRateLimiter,
    ...portProviders,
    ...applicationHandlers,
    AiConnectionResolver,
    AiResolvedConnectionFactory,
    AiChatContextBuilder,
    GeminiGenerateContentProtocolAdapter,
    AnthropicMessagesProtocolAdapter,
    OpenAiResponsesProtocolAdapter,
    OpenAiChatCompletionsProtocolAdapter,
    AiProtocolRegistry,
    ChapterTranslationQueueAdapter,
  ],
})
export class AiModule {}
