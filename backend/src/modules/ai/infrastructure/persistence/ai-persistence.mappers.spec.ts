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
  it('đọc legacy OpenAI official thành Responses protocol', () => {
    expect(toDomainAiProtocol(null, PrismaAiProvider.OPENAI)).toBe(
      AiProtocol.OPENAI_RESPONSES,
    );
  });

  it('đọc legacy OpenAI-compatible thành Chat Completions protocol', () => {
    expect(toDomainAiProtocol(null, PrismaAiProvider.OPENAI_COMPATIBLE)).toBe(
      AiProtocol.OPENAI_CHAT_COMPLETIONS,
    );
  });

  it('legacy lookup tách official Responses khỏi compatible Chat', () => {
    expect(
      legacyPrismaProvidersForProtocol(AiProtocol.OPENAI_RESPONSES),
    ).toEqual([PrismaAiProvider.OPENAI]);
    expect(
      legacyPrismaProvidersForProtocol(AiProtocol.OPENAI_CHAT_COMPLETIONS),
    ).toEqual([PrismaAiProvider.OPENAI_COMPATIBLE]);
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
