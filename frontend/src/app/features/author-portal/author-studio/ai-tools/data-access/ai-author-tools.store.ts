import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, Observable } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
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
export class AiAuthorToolsStore {
  private readonly repository = inject(AiAuthorRepository);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private refreshPending = false;
  private scopeGeneration = 0;
  private storyId = '';
  private chapterId: string | undefined;
  readonly jobs = signal<readonly AiAuthorJob[]>([]);
  readonly characters = signal<readonly AuthorStoryCharacter[]>([]);
  readonly issues = signal<readonly AuthorConsistencyIssue[]>([]);
  readonly connections = signal<readonly AuthorAiConnection[]>([]);
  readonly policy = signal<AuthorAiPolicy | null>(null);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      this.stop();
    });
  }

  load(storyId: string, chapterId?: string): void {
    this.stop();
    this.storyId = storyId;
    this.chapterId = chapterId;
    this.scopeGeneration++;
    this.jobs.set([]);
    this.characters.set([]);
    this.issues.set([]);
    this.error.set(null);
    forkJoin({ connections: this.repository.connections(), policy: this.repository.policy() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ connections, policy }) => {
          this.connections.set(connections.filter((c) => c.enabled));
          this.policy.set(policy);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
    this.refresh();
  }
  refresh(): void {
    if (this.disposed) return;
    if (this.loading()) {
      this.refreshPending = true;
      return;
    }
    this.stop();
    const generation = this.scopeGeneration;
    this.loading.set(true);
    forkJoin({
      jobs: this.repository.jobs(this.storyId),
      characters: this.repository.characters(this.storyId),
      issues: this.repository.issues(this.storyId, this.chapterId),
    })
      .pipe(
        finalize(() => {
          this.loading.set(false);
          if (this.refreshPending) {
            this.refreshPending = false;
            this.refresh();
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ jobs, characters, issues }) => {
          if (generation !== this.scopeGeneration) return;
          this.jobs.set(jobs);
          this.characters.set(characters);
          this.issues.set(issues);
          if (
            jobs.some((job) => job.status === 'PENDING' || job.status === 'PROCESSING') &&
            this.browser
          )
            this.timer = setTimeout(() => this.refresh(), 3000);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
  create(input: CreateAiAuthorJob): void {
    this.mutate(this.repository.create(this.storyId, input));
  }
  action(jobId: string, action: 'cancel' | 'retry'): void {
    this.mutate(this.repository.action(this.storyId, jobId, action));
  }
  verify(character: AuthorStoryCharacter): void {
    this.mutate(this.repository.verify(this.storyId, character.id, !character.isVerified));
  }
  updateIssue(issueId: string, input: { isResolved?: boolean; isDismissed?: boolean }): void {
    this.mutate(this.repository.updateIssue(this.storyId, issueId, input));
  }
  private mutate(request: Observable<unknown>): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    request
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.refresh(),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
  private stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
