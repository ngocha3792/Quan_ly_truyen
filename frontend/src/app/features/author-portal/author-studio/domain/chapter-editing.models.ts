import { AuthorChapterStatus } from './author-story-management.models';

export interface ChapterDraft {
  readonly title: string;
  readonly content: string;
}
export interface ChapterRecoveryScope {
  readonly accountId: string;
  readonly storyId: string;
  readonly chapterId: string | null;
  readonly tabId: string;
}
export interface ChapterRecoveryEntry extends ChapterRecoveryScope, ChapterDraft {
  readonly key: string;
  readonly savedAt: number;
  readonly revision: number;
  readonly baseVersion: number | null;
}
export interface ChapterDiffChange {
  readonly type: 'added' | 'removed' | 'unchanged';
  readonly value: string;
  readonly count: number;
}
export interface ChapterVersionDiff {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly changes: readonly ChapterDiffChange[];
  readonly titleChanges: readonly ChapterDiffChange[];
  readonly stats: { readonly added: number; readonly removed: number; readonly unchanged: number };
}
export interface ChapterWorkflow {
  readonly status: AuthorChapterStatus;
  readonly version: number;
  readonly canEdit: boolean;
  readonly canSubmit: boolean;
  readonly canPublish: boolean;
  readonly canReopen: boolean;
  readonly reviews: readonly {
    readonly id: string;
    readonly reviewerId: string;
    readonly reviewerName: string;
    readonly decision: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES';
    readonly comment: string | null;
    readonly reviewedVersion: number;
    readonly createdAt: string;
  }[];
}
export interface ChapterEditorPresence {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly tabId: string | null;
  readonly expiresAt: string;
  readonly lastHeartbeatAt: string;
}
export interface ChapterEditSession extends ChapterEditorPresence {
  readonly sessionToken: string;
}
