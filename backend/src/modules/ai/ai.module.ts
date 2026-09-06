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
  AI_USAGE_PERSISTENCE_PORT,
  AiChatContextBuilderService,
  AiConnectionResolverService,
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
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
  GeminiProviderAdapter,
  OpenAiCompatibleProviderAdapter,
  OpenAiProviderAdapter,
  PrismaAiConnectionPersistence,
  PrismaAiConversationPersistence,
  PrismaAiUsagePersistence,
  PrismaChapterTranslationPersistence,
} from './infrastructure';
import {
  AdminAiConnectionsController,
  AiChatController,
  AiConnectionsController,
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
    provide: CHAPTER_TRANSLATION_PERSISTENCE_PORT,
    useExisting: PrismaChapterTranslationPersistence,
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
    AiConnectionsController,
    AiChatController,
    ChapterTranslationsController,
  ],
  providers: [
    PrismaAiConnectionPersistence,
    PrismaAiConversationPersistence,
    PrismaAiUsagePersistence,
    PrismaChapterTranslationPersistence,
    AiApiKeyCipherAdapter,
    AiGatewayService,
    ...portProviders,
    ...applicationHandlers,
    AiConnectionResolverService,
    AiChatContextBuilderService,
    GeminiProviderAdapter,
    OpenAiProviderAdapter,
    AnthropicProviderAdapter,
    OpenAiCompatibleProviderAdapter,
    AiProviderRegistry,
  ],
})
export class AiModule {}
