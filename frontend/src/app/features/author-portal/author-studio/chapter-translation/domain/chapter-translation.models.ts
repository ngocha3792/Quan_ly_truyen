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
}

export interface TargetLanguageOption {
  readonly code: string;
  readonly label: string;
}

export const TARGET_LANGUAGE_OPTIONS: readonly TargetLanguageOption[] = [
  { code: 'en', label: 'Tiếng Anh' },
  { code: 'zh', label: 'Tiếng Trung' },
  { code: 'ja', label: 'Tiếng Nhật' },
  { code: 'ko', label: 'Tiếng Hàn' },
  { code: 'fr', label: 'Tiếng Pháp' },
  { code: 'es', label: 'Tiếng Tây Ban Nha' },
];
