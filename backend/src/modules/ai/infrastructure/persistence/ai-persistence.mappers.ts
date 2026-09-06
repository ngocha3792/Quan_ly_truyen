import {
  AiMessageRole as PrismaAiMessageRole,
  AiProvider as PrismaAiProvider,
} from '@/generated/prisma/client';

import { AiMessageRole, AiProvider } from '../../domain/enums';

export function toDomainAiProvider(provider: PrismaAiProvider): AiProvider {
  switch (provider) {
    case PrismaAiProvider.GEMINI:
      return AiProvider.GEMINI;
    case PrismaAiProvider.OPENAI:
      return AiProvider.OPENAI;
    case PrismaAiProvider.ANTHROPIC:
      return AiProvider.ANTHROPIC;
    case PrismaAiProvider.OPENAI_COMPATIBLE:
      return AiProvider.OPENAI_COMPATIBLE;
  }
}

export function toPrismaAiProvider(provider: AiProvider): PrismaAiProvider {
  switch (provider) {
    case AiProvider.GEMINI:
      return PrismaAiProvider.GEMINI;
    case AiProvider.OPENAI:
      return PrismaAiProvider.OPENAI;
    case AiProvider.ANTHROPIC:
      return PrismaAiProvider.ANTHROPIC;
    case AiProvider.OPENAI_COMPATIBLE:
      return PrismaAiProvider.OPENAI_COMPATIBLE;
  }
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
