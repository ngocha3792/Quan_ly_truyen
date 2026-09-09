export const AUTHOR_JOB_TYPES = [
  'CHAPTER_SUMMARY',
  'STORY_SUMMARY',
  'CHARACTER_EXTRACTION',
  'CONSISTENCY_CHECK',
] as const;
export type AuthorJobType = (typeof AUTHOR_JOB_TYPES)[number];
export type AuthorJobStatus =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export interface AuthorSourceChapter {
  id: string;
  version: number;
  number: string;
  title: string;
  content: string;
  blocks?: Array<{ id: string; text: string }>;
}
export interface AuthorSourceSnapshot {
  storyVersion: number;
  charactersHash?: string;
  chapters: Array<{
    id: string;
    version: number;
    number: string;
    hash: string;
    blockIds?: string[];
  }>;
}
export interface AuthorSource {
  storyVersion: number;
  chapters: AuthorSourceChapter[];
  characters?: Array<{
    id: string;
    name: string;
    description: string | null;
    aliases: string[];
    isVerified: boolean;
    updatedAt: string;
  }>;
}
export interface CreateAuthorJob {
  userId: string;
  storyId: string;
  jobType: AuthorJobType;
  chapterId?: string;
  connectionId: string;
  expectedVersion?: number;
}
export interface AuthorCharacter {
  name: string;
  aliases: string[];
  description: string;
  firstAppearance: string;
  appearances: Array<{ chapterId: string; role: string; mentions: number }>;
  relationships: Array<{ with: string; type: string; description: string }>;
}
export interface AuthorIssue {
  chapterId: string;
  blockId?: string | null;
  issueType: string;
  severity: string;
  description: string;
  suggestion: string;
  relatedChapterIds: string[];
}
export type AuthorResult =
  | { summary: string }
  | { characters: AuthorCharacter[] }
  | { issues: AuthorIssue[] };
export interface AuthorJob {
  id: string;
  userId: string;
  storyId: string;
  chapterId: string | null;
  connectionId: string;
  jobType: AuthorJobType;
  status: AuthorJobStatus;
  sourceSnapshot: AuthorSourceSnapshot;
  result: AuthorResult | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalCost: string | null;
  protocol: string | null;
  model: string | null;
  failureReason: string | null;
  retryCount: number;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface AuthorJobUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  protocol: string;
  model: string;
  connectionId: string | null;
}
export interface StoredAuthorCharacter extends AuthorCharacter {
  id: string;
  storyId: string;
  isVerified: boolean;
  extractedBy: string | null;
}
export interface StoredAuthorIssue extends AuthorIssue {
  id: string;
  sourceVersion: number;
  isDismissed: boolean;
  isResolved: boolean;
  detectedBy: string;
}
export class AuthorJobError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
