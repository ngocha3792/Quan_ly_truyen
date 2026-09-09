export type ChapterTranslationStatusValue = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ChapterTranslation {
  readonly id: string;
  readonly targetLanguageCode: string;
  readonly status: ChapterTranslationStatusValue;
  readonly translatedTitle: string | null;
  readonly translatedContent: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
  readonly revisionNotes: string | null;
  readonly sourceContentHash: string;
  readonly generation: number;
  readonly sourceVersion: number | null;
}

export interface TranslationReviewInput {
  readonly decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';
  readonly notes?: string;
  readonly translatedTitle?: string;
  readonly translatedContent?: string;
}
export interface TranslationReviewRequest extends TranslationReviewInput {
  readonly expectedVersion: number;
  readonly translationId: string;
  readonly generation: number;
}

export interface TargetLanguageOption {
  readonly code: string;
  readonly label: string;
}

export interface AiStoryProfile {
  readonly scope: 'STORY';
  readonly userId: string;
  readonly storyId: string;
  readonly model: string | null;
  readonly systemPrompt: string | null;
  readonly defaultTranslationLanguageCode: string;
  readonly autoTranslateOnPublish: boolean;
  readonly inherits: readonly string[];
  readonly updatedAt: string | null;
}

export interface UpdateAiStoryProfilePayload {
  readonly model: string | null;
  readonly systemPrompt: string | null;
  readonly defaultTranslationLanguageCode: string | null;
  readonly autoTranslateOnPublish: boolean | null;
}

export const TARGET_LANGUAGE_OPTIONS: readonly TargetLanguageOption[] = [
  { code: 'en', label: 'Tiếng Anh' },
  { code: 'zh', label: 'Tiếng Trung' },
  { code: 'ja', label: 'Tiếng Nhật' },
  { code: 'ko', label: 'Tiếng Hàn' },
  { code: 'fr', label: 'Tiếng Pháp' },
  { code: 'es', label: 'Tiếng Tây Ban Nha' },
];
