import type { ChapterRecord } from './chapter.persistence.port';
import type { ChapterWorkflowAction } from '../../domain/policies/chapter-workflow.policy';

export const CHAPTER_WORKFLOW_PORT = Symbol('CHAPTER_WORKFLOW_PORT');
export const CHAPTER_EDIT_SESSION_PORT = Symbol('CHAPTER_EDIT_SESSION_PORT');

export interface ChapterReviewRecord {
  id: string;
  reviewerId: string;
  reviewerName: string;
  decision: string;
  comment: string | null;
  reviewedVersion: number;
  createdAt: Date;
}

export interface ChapterWorkflowRecord {
  chapter: ChapterRecord;
  storyTitle: string;
  canEdit: boolean;
  canSubmit: boolean;
  canPublish: boolean;
  canReopen: boolean;
  reviews: readonly ChapterReviewRecord[];
}

export interface ChapterWorkflowMutation {
  userId: string;
  storyId?: string;
  chapterId: string;
  expectedVersion: number;
  action: ChapterWorkflowAction;
  comment?: string;
  audit: { ipAddress?: string; userAgent?: string; requestId?: string };
}

export interface ChapterWorkflowPort {
  transition(input: ChapterWorkflowMutation): Promise<ChapterRecord>;
  get(
    userId: string,
    chapterId: string,
    storyId?: string,
  ): Promise<ChapterWorkflowRecord>;
  listReviews(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{
    items: readonly ChapterWorkflowRecord[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export interface ChapterEditSessionRecord {
  id: string;
  userId: string;
  displayName: string;
  tabId: string;
  expiresAt: Date;
  lastHeartbeatAt: Date;
  sessionToken?: string;
}

export interface ChapterEditSessionPort {
  list(
    userId: string,
    storyId: string,
    chapterId: string,
  ): Promise<readonly ChapterEditSessionRecord[]>;
  save(
    userId: string,
    storyId: string,
    chapterId: string,
    tabId: string,
    token?: string,
  ): Promise<ChapterEditSessionRecord>;
  remove(
    userId: string,
    storyId: string,
    chapterId: string,
    token: string,
  ): Promise<void>;
}
