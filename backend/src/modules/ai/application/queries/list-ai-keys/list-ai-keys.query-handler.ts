import { Inject, Injectable } from '@nestjs/common';

import { AiProvider } from '@/generated/prisma/client';

import { AiApiKeyCipherAdapter } from '../../../infrastructure/security/ai-api-key-cipher.adapter';
import {
  AI_KEY_PERSISTENCE_PORT,
  AiKeyPersistencePort,
} from '../../ports/ai-key.persistence.port';
import { ListAiKeysQuery } from './list-ai-keys.query';
import { AiKeyStatusView } from './list-ai-keys.view';

const ALL_PROVIDERS: readonly AiProvider[] = [
  AiProvider.GEMINI,
  AiProvider.OPENAI,
  AiProvider.ANTHROPIC,
];

@Injectable()
export class ListAiKeysQueryHandler {
  constructor(
    @Inject(AI_KEY_PERSISTENCE_PORT)
    private readonly persistence: AiKeyPersistencePort,
    private readonly cipher: AiApiKeyCipherAdapter,
  ) {}

  async execute(query: ListAiKeysQuery): Promise<readonly AiKeyStatusView[]> {
    const records = await this.persistence.listByUser(query.userId);
    const byProvider = new Map(
      records.map((record) => [record.provider, record]),
    );

    return ALL_PROVIDERS.map((provider): AiKeyStatusView => {
      const record = byProvider.get(provider);

      if (!record) {
        return { provider, configured: false, lastFour: null, updatedAt: null };
      }

      const decrypted = this.cipher.decrypt(record.encryptedKey);

      return {
        provider,
        configured: true,
        lastFour: decrypted.slice(-4),
        updatedAt: record.updatedAt.toISOString(),
      };
    });
  }
}
