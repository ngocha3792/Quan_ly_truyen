import {
  AiAuthType as PrismaAiAuthType,
  AiMessageRole as PrismaAiMessageRole,
  AiProtocol as PrismaAiProtocol,
  AiProvider as PrismaAiProvider,
  ChapterTranslationStatus as PrismaChapterTranslationStatus,
} from '@/generated/prisma/client';

import {
  AiAuthType,
  AiMessageRole,
  AiProtocol,
  ChapterTranslationStatus,
} from '../../domain/enums';

export function toDomainAiProtocol(
  protocol: PrismaAiProtocol | null,
  legacyProvider: PrismaAiProvider,
): AiProtocol {
  if (protocol) {
    switch (protocol) {
      case PrismaAiProtocol.OPENAI_RESPONSES:
        return AiProtocol.OPENAI_RESPONSES;
      case PrismaAiProtocol.OPENAI_CHAT_COMPLETIONS:
        return AiProtocol.OPENAI_CHAT_COMPLETIONS;
      case PrismaAiProtocol.ANTHROPIC_MESSAGES:
        return AiProtocol.ANTHROPIC_MESSAGES;
      case PrismaAiProtocol.GEMINI_GENERATE_CONTENT:
        return AiProtocol.GEMINI_GENERATE_CONTENT;
    }
  }

  switch (legacyProvider) {
    case PrismaAiProvider.GEMINI:
      return AiProtocol.GEMINI_GENERATE_CONTENT;
    case PrismaAiProvider.ANTHROPIC:
      return AiProtocol.ANTHROPIC_MESSAGES;
    case PrismaAiProvider.OPENAI:
      return AiProtocol.OPENAI_RESPONSES;
    case PrismaAiProvider.OPENAI_COMPATIBLE:
      return AiProtocol.OPENAI_CHAT_COMPLETIONS;
  }
}

export function toPrismaAiProtocol(protocol: AiProtocol): PrismaAiProtocol {
  return PrismaAiProtocol[protocol];
}

export function toDomainAiAuthType(
  authType: PrismaAiAuthType | null,
  protocol: AiProtocol,
): AiAuthType {
  if (authType) return AiAuthType[authType];

  switch (protocol) {
    case AiProtocol.ANTHROPIC_MESSAGES:
      return AiAuthType.X_API_KEY;
    case AiProtocol.GEMINI_GENERATE_CONTENT:
      return AiAuthType.QUERY_PARAM;
    case AiProtocol.OPENAI_RESPONSES:
    case AiProtocol.OPENAI_CHAT_COMPLETIONS:
      return AiAuthType.BEARER;
  }
}

export function toPrismaAiAuthType(authType: AiAuthType): PrismaAiAuthType {
  return PrismaAiAuthType[authType];
}

export function toLegacyPrismaAiProvider(
  protocol: AiProtocol,
  vendorHint: string | null,
): PrismaAiProvider {
  switch (protocol) {
    case AiProtocol.GEMINI_GENERATE_CONTENT:
      return PrismaAiProvider.GEMINI;
    case AiProtocol.ANTHROPIC_MESSAGES:
      return PrismaAiProvider.ANTHROPIC;
    case AiProtocol.OPENAI_RESPONSES:
      return PrismaAiProvider.OPENAI;
    case AiProtocol.OPENAI_CHAT_COMPLETIONS:
      return vendorHint === 'OPENAI'
        ? PrismaAiProvider.OPENAI
        : PrismaAiProvider.OPENAI_COMPATIBLE;
  }
}

export function legacyPrismaProvidersForProtocol(
  protocol: AiProtocol,
): readonly PrismaAiProvider[] {
  if (protocol === AiProtocol.OPENAI_CHAT_COMPLETIONS) {
    return [PrismaAiProvider.OPENAI_COMPATIBLE];
  }

  return [toLegacyPrismaAiProvider(protocol, null)];
}

export function vendorHintFromLegacyProvider(
  provider: PrismaAiProvider,
): string {
  return provider;
}

export function defaultBaseUrlForProtocol(protocol: AiProtocol): string {
  switch (protocol) {
    case AiProtocol.OPENAI_RESPONSES:
    case AiProtocol.OPENAI_CHAT_COMPLETIONS:
      return 'https://api.openai.com/v1';
    case AiProtocol.ANTHROPIC_MESSAGES:
      return 'https://api.anthropic.com/v1';
    case AiProtocol.GEMINI_GENERATE_CONTENT:
      return 'https://generativelanguage.googleapis.com/v1beta';
  }
}

export function baseUrlFromPersistence(
  baseUrl: string | null,
  protocol: AiProtocol,
  legacyProvider: PrismaAiProvider,
): string {
  if (baseUrl) return baseUrl;

  // Never reinterpret a malformed proxy connection as an official OpenAI
  // connection: an empty URL is rejected before any outbound request.
  if (legacyProvider === PrismaAiProvider.OPENAI_COMPATIBLE) return '';

  return defaultBaseUrlForProtocol(protocol);
}

export function toDomainAiMessageRole(
  role: PrismaAiMessageRole,
): AiMessageRole {
  switch (role) {
    case PrismaAiMessageRole.USER:
      return AiMessageRole.USER;
    case PrismaAiMessageRole.ASSISTANT:
      return AiMessageRole.ASSISTANT;
  }
}

export function toPrismaAiMessageRole(
  role: AiMessageRole,
): PrismaAiMessageRole {
  switch (role) {
    case AiMessageRole.USER:
      return PrismaAiMessageRole.USER;
    case AiMessageRole.ASSISTANT:
      return PrismaAiMessageRole.ASSISTANT;
  }
}

export function toDomainChapterTranslationStatus(
  status: PrismaChapterTranslationStatus,
): ChapterTranslationStatus {
  switch (status) {
    case PrismaChapterTranslationStatus.PENDING:
      return ChapterTranslationStatus.PENDING;
    case PrismaChapterTranslationStatus.PROCESSING:
      return ChapterTranslationStatus.PROCESSING;
    case PrismaChapterTranslationStatus.COMPLETED:
      return ChapterTranslationStatus.COMPLETED;
    case PrismaChapterTranslationStatus.FAILED:
      return ChapterTranslationStatus.FAILED;
  }
}
