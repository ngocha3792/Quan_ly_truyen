import { Observable } from 'rxjs';
import {
  AiAuthorJob,
  AuthorAiConnection,
  AuthorAiPolicy,
  AuthorConsistencyIssue,
  AuthorStoryCharacter,
  CreateAiAuthorJob,
} from './ai-author.models';

export abstract class AiAuthorRepository {
  abstract connections(): Observable<readonly AuthorAiConnection[]>;
  abstract policy(): Observable<AuthorAiPolicy>;
  abstract jobs(storyId: string): Observable<readonly AiAuthorJob[]>;
  abstract create(storyId: string, input: CreateAiAuthorJob): Observable<AiAuthorJob>;
  abstract action(
    storyId: string,
    jobId: string,
    action: 'cancel' | 'retry',
  ): Observable<AiAuthorJob>;
  abstract characters(storyId: string): Observable<readonly AuthorStoryCharacter[]>;
  abstract verify(storyId: string, characterId: string, isVerified: boolean): Observable<void>;
  abstract issues(
    storyId: string,
    chapterId?: string,
  ): Observable<readonly AuthorConsistencyIssue[]>;
  abstract updateIssue(
    storyId: string,
    issueId: string,
    input: { isResolved?: boolean; isDismissed?: boolean },
  ): Observable<void>;
}
