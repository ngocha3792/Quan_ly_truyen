import type {
  AuthorJob,
  AuthorJobUsage,
  AuthorResult,
  AuthorSource,
  AuthorSourceSnapshot,
  CreateAuthorJob,
  StoredAuthorCharacter,
  StoredAuthorIssue,
} from './ai-author.types';

export const AI_AUTHOR_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.author-persistence',
);
export interface AiAuthorPersistencePort {
  assertAccess(userId: string, storyId: string): Promise<void>;
  source(
    input: Pick<
      CreateAuthorJob,
      'userId' | 'storyId' | 'chapterId' | 'jobType'
    >,
  ): Promise<AuthorSource>;
  create(
    input: CreateAuthorJob,
    snapshot: AuthorSourceSnapshot,
  ): Promise<AuthorJob>;
  find(id: string): Promise<AuthorJob | null>;
  list(userId: string, storyId: string): Promise<AuthorJob[]>;
  transition(
    userId: string,
    storyId: string,
    id: string,
    action: 'cancel' | 'retry',
  ): Promise<AuthorJob>;
  claim(id: string, leaseToken: string): Promise<AuthorJob | null>;
  complete(
    job: AuthorJob,
    result: AuthorResult,
    usage: AuthorJobUsage,
  ): Promise<boolean>;
  fail(job: AuthorJob, code: string): Promise<void>;
  characters(userId: string, storyId: string): Promise<StoredAuthorCharacter[]>;
  verifyCharacter(
    userId: string,
    storyId: string,
    id: string,
    isVerified: boolean,
  ): Promise<void>;
  issues(
    userId: string,
    storyId: string,
    chapterId?: string,
  ): Promise<StoredAuthorIssue[]>;
  updateIssue(
    userId: string,
    storyId: string,
    id: string,
    patch: { isDismissed?: boolean; isResolved?: boolean },
  ): Promise<void>;
}
