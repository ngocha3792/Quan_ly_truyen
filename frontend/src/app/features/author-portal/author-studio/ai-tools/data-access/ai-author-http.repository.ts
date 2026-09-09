import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';
import {
  AiAuthorJob,
  AuthorAiConnection,
  AuthorAiPolicy,
  AuthorConsistencyIssue,
  AuthorStoryCharacter,
  CreateAiAuthorJob,
} from '../domain/ai-author.models';
import { AiAuthorRepository } from '../domain/ai-author.repository';

@Injectable()
export class AiAuthorHttpRepository implements AiAuthorRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_RUNTIME_CONFIG).apiBaseUrl;
  connections() {
    return this.get<readonly AuthorAiConnection[]>(`${this.base}/ai/connections`);
  }
  policy() {
    return this.get<AuthorAiPolicy>(`${this.base}/ai/policy`);
  }
  jobs(storyId: string) {
    return this.get<readonly AiAuthorJob[]>(`${this.storyUrl(storyId)}/ai-jobs`);
  }
  create(storyId: string, input: CreateAiAuthorJob) {
    return this.http
      .post<ApiSuccessEnvelope<AiAuthorJob>>(`${this.storyUrl(storyId)}/ai-jobs`, input)
      .pipe(map((r) => r.data));
  }
  action(storyId: string, jobId: string, action: 'cancel' | 'retry') {
    return this.http
      .post<ApiSuccessEnvelope<AiAuthorJob>>(
        `${this.storyUrl(storyId)}/ai-jobs/${jobId}/${action}`,
        {},
      )
      .pipe(map((r) => r.data));
  }
  characters(storyId: string) {
    return this.get<readonly AuthorStoryCharacter[]>(`${this.storyUrl(storyId)}/characters`);
  }
  verify(storyId: string, characterId: string, isVerified: boolean) {
    return this.http.patch<void>(`${this.storyUrl(storyId)}/characters/${characterId}`, {
      isVerified,
    });
  }
  issues(storyId: string, chapterId?: string) {
    return this.http
      .get<ApiSuccessEnvelope<readonly AuthorConsistencyIssue[]>>(
        `${this.storyUrl(storyId)}/consistency-issues`,
        { params: chapterId ? { chapterId } : {} },
      )
      .pipe(map((r) => r.data));
  }
  updateIssue(
    storyId: string,
    issueId: string,
    input: { isResolved?: boolean; isDismissed?: boolean },
  ) {
    return this.http.patch<void>(`${this.storyUrl(storyId)}/consistency-issues/${issueId}`, input);
  }
  private storyUrl(storyId: string) {
    return `${this.base}/author/stories/${storyId}`;
  }
  private get<T>(url: string) {
    return this.http.get<ApiSuccessEnvelope<T>>(url).pipe(map((r) => r.data));
  }
}
