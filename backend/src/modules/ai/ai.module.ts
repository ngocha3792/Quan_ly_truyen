import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AI_KEY_PERSISTENCE_PORT,
  CreateAiConversationCommandHandler,
  DeleteAiConversationCommandHandler,
  GetAiConversationQueryHandler,
  ListAiConversationsQueryHandler,
  ListAiKeysQueryHandler,
  RemoveAiKeyCommandHandler,
  SaveAiKeyCommandHandler,
  SendAiMessageCommandHandler,
} from './application';
import {
  AiApiKeyCipherAdapter,
  AiProviderRegistry,
  AnthropicProviderAdapter,
  GeminiProviderAdapter,
  OpenAiProviderAdapter,
  PrismaAiConversationPersistence,
  PrismaAiKeyPersistence,
} from './infrastructure';
import {
  AdminAiSettingsController,
  AiChatController,
  AiKeysController,
} from './presentation/http';

const portProviders = [
  {
    provide: AI_KEY_PERSISTENCE_PORT,
    useExisting: PrismaAiKeyPersistence,
  },
  {
    provide: AI_CONVERSATION_PERSISTENCE_PORT,
    useExisting: PrismaAiConversationPersistence,
  },
];

const applicationHandlers = [
  SaveAiKeyCommandHandler,
  RemoveAiKeyCommandHandler,
  ListAiKeysQueryHandler,
  CreateAiConversationCommandHandler,
  DeleteAiConversationCommandHandler,
  ListAiConversationsQueryHandler,
  GetAiConversationQueryHandler,
  SendAiMessageCommandHandler,
];

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminAiSettingsController, AiKeysController, AiChatController],
  providers: [
    PrismaAiKeyPersistence,
    PrismaAiConversationPersistence,
    ...portProviders,
    ...applicationHandlers,
    AiApiKeyCipherAdapter,
    GeminiProviderAdapter,
    OpenAiProviderAdapter,
    AnthropicProviderAdapter,
    AiProviderRegistry,
  ],
})
export class AiModule {}
