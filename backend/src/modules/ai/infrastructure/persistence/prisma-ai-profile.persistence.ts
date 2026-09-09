import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';

import {
  AiProfilePersistencePort,
  AiStoryProfileRecord,
  AiUserProfileRecord,
  UpdateAiStoryProfileInput,
  UpdateAiUserProfileInput,
} from '../../application/ports/ai-profile.persistence.port';

@Injectable()
export class PrismaAiProfilePersistence implements AiProfilePersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async userExists(userId: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { id: userId } })) > 0;
  }

  async storyExistsForOwner(userId: string, storyId: string): Promise<boolean> {
    return (
      (await this.prisma.story.count({
        where: { id: storyId, authorId: userId, deletedAt: null },
      })) > 0
    );
  }

  async findUser(userId: string): Promise<AiUserProfileRecord | null> {
    return this.prisma.aiUserProfile.findUnique({ where: { userId } });
  }

  async storyExistsForEditor(
    userId: string,
    storyId: string,
  ): Promise<boolean> {
    return (
      (await this.prisma.story.count({
        where: {
          id: storyId,
          deletedAt: null,
          contributors: { some: { userId, canEdit: true } },
        },
      })) > 0
    );
  }

  async findStory(storyId: string): Promise<AiStoryProfileRecord | null> {
    return this.prisma.aiStoryProfile.findUnique({ where: { storyId } });
  }

  async upsertUser(
    userId: string,
    input: UpdateAiUserProfileInput,
  ): Promise<AiUserProfileRecord> {
    return this.prisma.aiUserProfile.upsert({
      where: { userId },
      create: {
        userId,
        model: input.model,
        systemPrompt: input.systemPrompt,
        defaultTranslationLanguageCode:
          input.defaultTranslationLanguageCode ?? 'en',
        autoTranslateOnPublish: input.autoTranslateOnPublish ?? false,
      },
      update: input,
    });
  }

  async upsertStory(
    userId: string,
    storyId: string,
    input: UpdateAiStoryProfileInput,
  ): Promise<AiStoryProfileRecord> {
    return this.prisma.aiStoryProfile.upsert({
      where: { storyId },
      create: { storyId, userId, ...input },
      update: input,
    });
  }
}
