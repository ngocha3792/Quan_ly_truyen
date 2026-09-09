import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { MediaModule } from '@/modules/media';

import {
  CreateTtsConnectionCommandHandler,
  DeleteTtsConnectionCommandHandler,
  GenerateTtsManifestCommandHandler,
  GetTtsManifestQueryHandler,
  GetTtsQuotaQueryHandler,
  ListTtsConnectionsQueryHandler,
  TTS_CREDENTIAL_VAULT_PORT,
  TTS_GENERATION_QUEUE_PORT,
  TTS_PERSISTENCE_PORT,
  TTS_PROVIDER_PORT,
} from './application';
import {
  ElevenLabsTtsAdapter,
  PrismaTtsPersistence,
  TtsApiKeyCipherAdapter,
  TtsGenerationQueueAdapter,
} from './infrastructure';
import {
  AdminTtsController,
  TtsController,
  TtsFeatureGuard,
} from './presentation';

const adapters = [
  PrismaTtsPersistence,
  ElevenLabsTtsAdapter,
  TtsApiKeyCipherAdapter,
  TtsGenerationQueueAdapter,
];
const ports = [
  { provide: TTS_PERSISTENCE_PORT, useExisting: PrismaTtsPersistence },
  { provide: TTS_PROVIDER_PORT, useExisting: ElevenLabsTtsAdapter },
  { provide: TTS_CREDENTIAL_VAULT_PORT, useExisting: TtsApiKeyCipherAdapter },
  {
    provide: TTS_GENERATION_QUEUE_PORT,
    useExisting: TtsGenerationQueueAdapter,
  },
];

@Module({
  imports: [PrismaModule, MediaModule, AuthAuthorizationModule],
  controllers: [TtsController, AdminTtsController],
  providers: [
    ...adapters,
    ...ports,
    TtsFeatureGuard,
    CreateTtsConnectionCommandHandler,
    ListTtsConnectionsQueryHandler,
    DeleteTtsConnectionCommandHandler,
    GenerateTtsManifestCommandHandler,
    GetTtsManifestQueryHandler,
    GetTtsQuotaQueryHandler,
  ],
})
export class TtsModule {}
