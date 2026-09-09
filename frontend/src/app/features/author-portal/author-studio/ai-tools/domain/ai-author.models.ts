export type AiAuthorJobType =
  'CHAPTER_SUMMARY' | 'STORY_SUMMARY' | 'CHARACTER_EXTRACTION' | 'CONSISTENCY_CHECK';
export type AiAuthorJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AuthorAiConnection {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly defaultModel: string | null;
}
export interface AuthorAiPolicy {
  readonly fallbackPolicy: 'NONE' | 'SYSTEM';
}
export interface AiAuthorJob {
  readonly sourceStale: boolean;
  readonly id: string;
  readonly storyId: string;
  readonly chapterId: string | null;
  readonly jobType: AiAuthorJobType;
  readonly status: AiAuthorJobStatus;
  readonly result: { readonly summary?: string } | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalCost: string | null;
  readonly costStatus: 'UNAVAILABLE' | 'REPORTED';
  readonly model: string | null;
  readonly protocol: string | null;
  readonly failureReason: string | null;
  readonly retryCount: number;
  readonly sourceSnapshot: {
    readonly storyVersion: number;
    readonly chapters: readonly {
      readonly id: string;
      readonly version: number;
      readonly number: number;
    }[];
  };
  readonly createdAt: string;
}
export interface AuthorStoryCharacter {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string | null;
  readonly firstAppearance: string | null;
  readonly appearances:
    | readonly { readonly chapterId: string; readonly role: string; readonly mentions: number }[]
    | null;
  readonly relationships:
    | readonly { readonly with: string; readonly type: string; readonly description: string }[]
    | null;
  readonly isVerified: boolean;
}
export interface AuthorConsistencyIssue {
  readonly id: string;
  readonly chapterId: string;
  readonly sourceVersion: number;
  readonly issueType: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly description: string;
  readonly suggestion: string | null;
  readonly relatedChapterIds: readonly string[];
  readonly isDismissed: boolean;
  readonly isResolved: boolean;
}
export interface CreateAiAuthorJob {
  readonly jobType: AiAuthorJobType;
  readonly chapterId?: string;
  readonly expectedVersion?: number;
  readonly connectionId: string;
}
export const AI_AUTHOR_TOOLS: readonly {
  readonly value: AiAuthorJobType;
  readonly label: string;
  readonly chapter: boolean;
}[] = [
  { value: 'CHAPTER_SUMMARY', label: 'Tóm tắt chương', chapter: true },
  { value: 'STORY_SUMMARY', label: 'Tóm tắt truyện', chapter: false },
  { value: 'CHARACTER_EXTRACTION', label: 'Nhân vật và dòng thời gian', chapter: false },
  { value: 'CONSISTENCY_CHECK', label: 'Kiểm tra tính nhất quán', chapter: true },
];
export const AI_JOB_STATUS_LABELS: Record<AiAuthorJobStatus, string> = {
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang phân tích',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
};
