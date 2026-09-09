export const AI_PROFILE_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.profile-persistence',
);

export interface AiUserProfileRecord {
  readonly userId: string;
  readonly model: string | null;
  readonly systemPrompt: string | null;
  readonly defaultTranslationLanguageCode: string;
  readonly autoTranslateOnPublish: boolean;
  readonly updatedAt: Date | null;
}

export interface AiStoryProfileRecord {
  readonly storyId: string;
  readonly userId: string;
  readonly model: string | null;
  readonly systemPrompt: string | null;
  readonly defaultTranslationLanguageCode: string | null;
  readonly autoTranslateOnPublish: boolean | null;
  readonly updatedAt: Date;
}

export interface UpdateAiUserProfileInput {
  readonly model?: string | null;
  readonly systemPrompt?: string | null;
  readonly defaultTranslationLanguageCode?: string;
  readonly autoTranslateOnPublish?: boolean;
}

export interface UpdateAiStoryProfileInput {
  readonly model?: string | null;
  readonly systemPrompt?: string | null;
  readonly defaultTranslationLanguageCode?: string | null;
  readonly autoTranslateOnPublish?: boolean | null;
}

export interface AiProfilePersistencePort {
  userExists(userId: string): Promise<boolean>;
  storyExistsForOwner(userId: string, storyId: string): Promise<boolean>;
  storyExistsForEditor(userId: string, storyId: string): Promise<boolean>;
  findUser(userId: string): Promise<AiUserProfileRecord | null>;
  findStory(storyId: string): Promise<AiStoryProfileRecord | null>;
  upsertUser(
    userId: string,
    input: UpdateAiUserProfileInput,
  ): Promise<AiUserProfileRecord>;
  upsertStory(
    userId: string,
    storyId: string,
    input: UpdateAiStoryProfileInput,
  ): Promise<AiStoryProfileRecord>;
}
