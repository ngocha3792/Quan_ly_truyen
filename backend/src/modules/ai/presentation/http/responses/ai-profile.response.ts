import type { AiProfileView } from '../../../application';

export interface AiProfileResponse {
  readonly scope: 'USER' | 'STORY';
  readonly userId: string;
  readonly storyId: string | null;
  readonly model: string | null;
  readonly systemPrompt: string | null;
  readonly defaultTranslationLanguageCode: string;
  readonly autoTranslateOnPublish: boolean;
  readonly inherits: AiProfileView['inherits'];
  readonly updatedAt: string | null;
}

export function toAiProfileResponse(view: AiProfileView): AiProfileResponse {
  return {
    scope: view.scope,
    userId: view.userId,
    storyId: view.storyId,
    model: view.model,
    systemPrompt: view.systemPrompt,
    defaultTranslationLanguageCode: view.defaultTranslationLanguageCode,
    autoTranslateOnPublish: view.autoTranslateOnPublish,
    inherits: view.inherits,
    updatedAt: view.updatedAt?.toISOString() ?? null,
  };
}
