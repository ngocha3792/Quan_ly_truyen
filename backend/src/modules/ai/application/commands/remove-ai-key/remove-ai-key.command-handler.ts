import { Inject, Injectable } from '@nestjs/common';

import {
  AI_KEY_PERSISTENCE_PORT,
  AiKeyPersistencePort,
} from '../../ports/ai-key.persistence.port';
import { RemoveAiKeyCommand } from './remove-ai-key.command';

@Injectable()
export class RemoveAiKeyCommandHandler {
  constructor(
    @Inject(AI_KEY_PERSISTENCE_PORT)
    private readonly persistence: AiKeyPersistencePort,
  ) {}

  async execute(command: RemoveAiKeyCommand): Promise<void> {
    await this.persistence.remove(command.userId, command.provider);
  }
}
