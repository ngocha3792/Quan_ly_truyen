import { Module } from '@nestjs/common';
import { TranslationReviewModule } from './translation-review.module';

import { PrismaModule } from '@/infrastructure/database';
import { CacheModule } from '@/infrastructure/cache';
import { AuthAuthorizationModule } from '@/modules/auth';
import { AuthorsModule } from '@/modules/authors';
import { ChaptersModule } from '@/modules/chapters';
import { OutboxCoreModule } from '@/infrastructure/queue/outbox/outbox-core.module';
import { AI_AUTHOR_PERSISTENCE_PORT } from './application/author-tools/ai-author.persistence.port';
import { AiAuthorConnectionResolver } from './application/author-tools/ai-author-connection.resolver';
import { AiAuthorJobManager } from './application/author-tools/ai-author-job.manager';
import { PrismaAiAuthorPersistence } from './infrastructure/persistence/prisma-ai-author.persistence';
import { AiAuthorKnowledgePersistence } from './infrastructure/persistence/ai-author-knowledge.persistence';
import { AiAuthorToolsController } from './presentation/http/controllers/ai-author-tools.controller';

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
  AI_USAGE_READER_PORT,
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
  GetAiUsageSummaryQueryHandler,
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
  PrismaAiUsageReader,
  PrismaChapterTranslationPersistence,
} from './infrastructure';
import {
  AdminAiConnectionsController,
  AdminAiUsageController,
  AdminAiPolicyController,
  AiChatController,
  AiConnectionsController,
  AiPolicyController,
  AiProfileController,
  AiUsageController,
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
    provide: AI_USAGE_READER_PORT,
    useExisting: PrismaAiUsageReader,
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
  GetAiUsageSummaryQueryHandler,
];

@Module({
  imports: [
    TranslationReviewModule,
    OutboxCoreModule,
    PrismaModule,
    CacheModule,
    AuthAuthorizationModule,
    ChaptersModule,
    AuthorsModule,
  ],
  controllers: [
    AiAuthorToolsController,
    AdminAiConnectionsController,
    AdminAiUsageController,
    AdminAiPolicyController,
    AiConnectionsController,
    AiPolicyController,
    AiProfileController,
    AiUsageController,
    AiStoryProfileController,
    AiChatController,
    ChapterTranslationsController,
  ],
  providers: [
    AiAuthorConnectionResolver,
    AiAuthorJobManager,
    PrismaAiAuthorPersistence,
    AiAuthorKnowledgePersistence,
    {
      provide: AI_AUTHOR_PERSISTENCE_PORT,
      useExisting: PrismaAiAuthorPersistence,
    },
    PrismaAiConnectionPersistence,
    PrismaAiConversationPersistence,
    PrismaAiUsagePersistence,
    PrismaAiUsageReader,
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
