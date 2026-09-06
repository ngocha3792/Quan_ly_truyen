import { Inject, Injectable } from '@nestjs/common';

import { AiApiKeyCipherAdapter } from '../../../infrastructure/security/ai-api-key-cipher.adapter';
import {
  AI_KEY_PERSISTENCE_PORT,
  AiKeyPersistencePort,
} from '../../ports/ai-key.persistence.port';
import { SaveAiKeyCommand } from './save-ai-key.command';

@Injectable()
export class SaveAiKeyCommandHandler {
  constructor(
    @Inject(AI_KEY_PERSISTENCE_PORT)
    private readonly persistence: AiKeyPersistencePort,
    private readonly cipher: AiApiKeyCipherAdapter,
  ) {}

  async execute(command: SaveAiKeyCommand): Promise<void> {
    const encryptedKey = this.cipher.encrypt(command.apiKey);

    await this.persistence.upsert(
      command.userId,
      command.provider,
      encryptedKey,
    );
  }
}
