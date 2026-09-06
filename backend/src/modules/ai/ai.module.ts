import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { AuthorsModule } from '@/modules/authors';
import { ChaptersModule } from '@/modules/chapters';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AI_CONVERSATION_PERSISTENCE_PORT,
  AI_CREDENTIAL_VAULT_PORT,
  AI_GATEWAY_PORT,
  AI_PROVIDER_REGISTRY_PORT,
  AI_POLICY_PERSISTENCE_PORT,
  AI_PROFILE_PERSISTENCE_PORT,
  AI_RATE_LIMIT_PERSISTENCE_PORT,
  AI_USAGE_PERSISTENCE_PORT,
  AiPolicyManager,
  AiProfileManager,
  AiRateLimiter,
  AiChatContextBuilder,
  AiConnectionResolver,
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
  RequestChapterTranslationCommandHandler,
  SendAiMessageCommandHandler,
  SendAiMessageStreamCommandHandler,
  TestAiConnectionCommandHandler,
  UpdateAiConnectionCommandHandler,
} from './application';
import {
  AiApiKeyCipherAdapter,
  AiGatewayService,
  AiProviderRegistry,
  AnthropicProviderAdapter,
  ChapterTranslationQueueAdapter,
  GeminiProviderAdapter,
  OpenAiCompatibleProviderAdapter,
  OpenAiProviderAdapter,
  PrismaAiConnectionPersistence,
  PrismaAiConversationPersistence,
  PrismaAiPolicyPersistence,
  PrismaAiProfilePersistence,
  PrismaAiRateLimitPersistence,
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
    provide: AI_PROVIDER_REGISTRY_PORT,
    useExisting: AiProviderRegistry,
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
    PrismaChapterTranslationPersistence,
    AiApiKeyCipherAdapter,
    AiGatewayService,
    AiPolicyManager,
    AiProfileManager,
    AiRateLimiter,
    ...portProviders,
    ...applicationHandlers,
    AiConnectionResolver,
    AiChatContextBuilder,
    GeminiProviderAdapter,
    OpenAiProviderAdapter,
    AnthropicProviderAdapter,
    OpenAiCompatibleProviderAdapter,
    AiProviderRegistry,
    ChapterTranslationQueueAdapter,
  ],
})
export class AiModule {}
