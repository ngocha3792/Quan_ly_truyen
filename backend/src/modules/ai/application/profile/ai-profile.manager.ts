import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_PROFILE_PERSISTENCE_PORT,
  AiProfilePersistencePort,
  UpdateAiStoryProfileInput,
  UpdateAiUserProfileInput,
} from '../ports/ai-profile.persistence.port';

export interface EffectiveAiProfile {
  readonly model: string | null;
  readonly systemPrompt: string | null;
  readonly defaultTranslationLanguageCode: string;
  readonly autoTranslateOnPublish: boolean;
}

export interface AiProfileView extends EffectiveAiProfile {
  readonly scope: 'USER' | 'STORY';
  readonly userId: string;
  readonly storyId: string | null;
  readonly inherits: readonly (
    | 'model'
    | 'systemPrompt'
    | 'defaultTranslationLanguageCode'
    | 'autoTranslateOnPublish'
  )[];
  readonly updatedAt: Date | null;
}

const DEFAULT_PROFILE: EffectiveAiProfile = {
  model: null,
  systemPrompt: null,
  defaultTranslationLanguageCode: 'en',
  autoTranslateOnPublish: false,
};

@Injectable()
export class AiProfileManager {
  constructor(
    @Inject(AI_PROFILE_PERSISTENCE_PORT)
    private readonly profiles: AiProfilePersistencePort,
  ) {}

  async getUser(userId: string): Promise<AiProfileView> {
    const record = await this.profiles.findUser(userId);
    if (!record && !(await this.profiles.userExists(userId))) {
      throw new ResourceNotFoundException({
        resource: 'người dùng',
        identifier: userId,
      });
    }

    return {
      scope: 'USER',
      userId,
      storyId: null,
      ...(record ?? DEFAULT_PROFILE),
      inherits: [],
      updatedAt: record?.updatedAt ?? null,
    };
  }

  async updateUser(
    userId: string,
    input: UpdateAiUserProfileInput,
  ): Promise<AiProfileView> {
    if (!(await this.profiles.userExists(userId))) {
      throw new ResourceNotFoundException({
        resource: 'người dùng',
        identifier: userId,
      });
    }
    await this.profiles.upsertUser(userId, input);
    return this.getUser(userId);
  }

  async getStory(userId: string, storyId: string): Promise<AiProfileView> {
    if (!(await this.profiles.storyExistsForOwner(userId, storyId))) {
      throw new ResourceNotFoundException({
        resource: 'truyện',
        identifier: storyId,
      });
    }

    const [user, story] = await Promise.all([
      this.resolveUser(userId),
      this.profiles.findStory(storyId),
    ]);
    const inherited: AiProfileView['inherits'][number][] = [];

    if (!story?.model) inherited.push('model');
    if (!story?.systemPrompt) inherited.push('systemPrompt');
    if (!story?.defaultTranslationLanguageCode)
      inherited.push('defaultTranslationLanguageCode');
    if (story?.autoTranslateOnPublish === null || story === null)
      inherited.push('autoTranslateOnPublish');

    return {
      scope: 'STORY',
      userId,
      storyId,
      model: story?.model ?? user.model,
      systemPrompt: story?.systemPrompt ?? user.systemPrompt,
      defaultTranslationLanguageCode:
        story?.defaultTranslationLanguageCode ??
        user.defaultTranslationLanguageCode,
      autoTranslateOnPublish:
        story?.autoTranslateOnPublish ?? user.autoTranslateOnPublish,
      inherits: inherited,
      updatedAt: story?.updatedAt ?? null,
    };
  }

  async updateStory(
    userId: string,
    storyId: string,
    input: UpdateAiStoryProfileInput,
  ): Promise<AiProfileView> {
    if (!(await this.profiles.storyExistsForOwner(userId, storyId))) {
      throw new ResourceNotFoundException({
        resource: 'truyện',
        identifier: storyId,
      });
    }
    await this.profiles.upsertStory(userId, storyId, input);
    return this.getStory(userId, storyId);
  }

  async resolve(userId: string, storyId?: string): Promise<EffectiveAiProfile> {
    const view = storyId
      ? await this.getStory(userId, storyId)
      : await this.getUser(userId);
    return {
      model: view.model,
      systemPrompt: view.systemPrompt,
      defaultTranslationLanguageCode: view.defaultTranslationLanguageCode,
      autoTranslateOnPublish: view.autoTranslateOnPublish,
    };
  }

  private async resolveUser(userId: string): Promise<EffectiveAiProfile> {
    const record = await this.profiles.findUser(userId);
    return record ?? DEFAULT_PROFILE;
  }
}
