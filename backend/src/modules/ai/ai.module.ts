import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AI_CONVERSATION_PERSISTENCE_PORT,
  AI_CREDENTIAL_VAULT_PORT,
  AI_GATEWAY_PORT,
  AI_PROVIDER_REGISTRY_PORT,
  AI_USAGE_PERSISTENCE_PORT,
  AiChatContextBuilder,
  AiConnectionResolver,
  CreateAiConnectionCommandHandler,
  CreateAiConversationCommandHandler,
  DeleteAiConnectionCommandHandler,
  DeleteAiConversationCommandHandler,
  GetAiConversationQueryHandler,
  ListAiConnectionModelsQueryHandler,
  ListAiConnectionsQueryHandler,
  ListAiConversationsQueryHandler,
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
} from './infrastructure';
import {
  AdminAiConnectionsController,
  AiChatController,
  AiConnectionsController,
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
    provide: AI_PROVIDER_REGISTRY_PORT,
    useExisting: AiProviderRegistry,
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
];

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [
    AdminAiConnectionsController,
    AiConnectionsController,
    AiChatController,
  ],
  providers: [
    PrismaAiConnectionPersistence,
    PrismaAiConversationPersistence,
    PrismaAiUsagePersistence,
    AiApiKeyCipherAdapter,
    AiGatewayService,
    ...portProviders,
    ...applicationHandlers,
    AiConnectionResolver,
    AiChatContextBuilder,
    GeminiProviderAdapter,
    OpenAiProviderAdapter,
    AnthropicProviderAdapter,
    OpenAiCompatibleProviderAdapter,
    AiProviderRegistry,
  ],
})
export class AiModule {}
