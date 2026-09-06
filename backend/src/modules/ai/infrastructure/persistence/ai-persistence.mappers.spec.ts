import {
  AiAuthType as PrismaAiAuthType,
  AiProvider as PrismaAiProvider,
} from '@/generated/prisma/client';

import { AiAuthType, AiProtocol } from '../../domain/enums';
import {
  baseUrlFromPersistence,
  legacyPrismaProvidersForProtocol,
  toDomainAiAuthType,
  toDomainAiProtocol,
  toLegacyPrismaAiProvider,
} from './ai-persistence.mappers';

describe('AI persistence compatibility mappers', () => {
  it.each([PrismaAiProvider.OPENAI, PrismaAiProvider.OPENAI_COMPATIBLE])(
    'đọc legacy %s thành OpenAI Chat Completions protocol',
    (provider) => {
      expect(toDomainAiProtocol(null, provider)).toBe(
        AiProtocol.OPENAI_CHAT_COMPLETIONS,
      );
    },
  );

  it('legacy lookup của OpenAI Chat nhận cả official và compatible', () => {
    expect(
      legacyPrismaProvidersForProtocol(AiProtocol.OPENAI_CHAT_COMPLETIONS),
    ).toEqual([PrismaAiProvider.OPENAI, PrismaAiProvider.OPENAI_COMPATIBLE]);
  });

  it('dual-write giữ đúng provider official theo vendor hint', () => {
    expect(
      toLegacyPrismaAiProvider(AiProtocol.OPENAI_CHAT_COMPLETIONS, 'OPENAI'),
    ).toBe(PrismaAiProvider.OPENAI);
  });

  it('đọc auth type mới hoặc suy ra auth mặc định cho row legacy', () => {
    expect(
      toDomainAiAuthType(
        PrismaAiAuthType.API_KEY_HEADER,
        AiProtocol.OPENAI_CHAT_COMPLETIONS,
      ),
    ).toBe(AiAuthType.API_KEY_HEADER);
    expect(toDomainAiAuthType(null, AiProtocol.ANTHROPIC_MESSAGES)).toBe(
      AiAuthType.X_API_KEY,
    );
  });

  it('không route proxy legacy thiếu base URL sang OpenAI official', () => {
    expect(
      baseUrlFromPersistence(
        null,
        AiProtocol.OPENAI_CHAT_COMPLETIONS,
        PrismaAiProvider.OPENAI_COMPATIBLE,
      ),
    ).toBe('');
  });
});
