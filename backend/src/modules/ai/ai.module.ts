import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AI_CONVERSATION_PERSISTENCE_PORT,
  AI_CREDENTIAL_VAULT_PORT,
  AI_GATEWAY_PORT,
  AiConnectionResolverService,
  CreateAiConnectionCommandHandler,
  CreateAiConversationCommandHandler,
  DeleteAiConnectionCommandHandler,
  DeleteAiConversationCommandHandler,
  GetAiConversationQueryHandler,
  ListAiConnectionModelsQueryHandler,
  ListAiConnectionsQueryHandler,
  ListAiConversationsQueryHandler,
  SendAiMessageCommandHandler,
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
    AiApiKeyCipherAdapter,
    AiGatewayService,
    ...portProviders,
    ...applicationHandlers,
    AiConnectionResolverService,
    GeminiProviderAdapter,
    OpenAiProviderAdapter,
    AnthropicProviderAdapter,
    OpenAiCompatibleProviderAdapter,
    AiProviderRegistry,
  ],
})
export class AiModule {}
