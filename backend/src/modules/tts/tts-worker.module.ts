import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { MediaModule } from '@/modules/media';

import {
  TTS_CREDENTIAL_VAULT_PORT,
  TTS_PERSISTENCE_PORT,
  TTS_PROVIDER_PORT,
} from './application';
import {
  ElevenLabsTtsAdapter,
  PrismaTtsPersistence,
  TtsApiKeyCipherAdapter,
  TtsGenerationProcessor,
} from './infrastructure';

@Module({
  imports: [PrismaModule, MediaModule],
  providers: [
    PrismaTtsPersistence,
    ElevenLabsTtsAdapter,
    TtsApiKeyCipherAdapter,
    TtsGenerationProcessor,
    { provide: TTS_PERSISTENCE_PORT, useExisting: PrismaTtsPersistence },
    { provide: TTS_PROVIDER_PORT, useExisting: ElevenLabsTtsAdapter },
    { provide: TTS_CREDENTIAL_VAULT_PORT, useExisting: TtsApiKeyCipherAdapter },
  ],
})
export class TtsWorkerModule {}
