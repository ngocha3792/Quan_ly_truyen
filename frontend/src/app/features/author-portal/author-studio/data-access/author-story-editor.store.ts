import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AuthorManagedStory,
  AuthorStoryDraftInput,
  AuthorStoryContributor,
  AuthorStoryContributorInput,
  AuthorStoryContributorRole,
  AuthorStoryMedia,
  AuthorStoryMetadataCategory,
  AuthorStoryMetadataTag,
  AuthorStoryPublication,
  AuthorStoryUpdateInput,
} from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';

@Injectable()
export class AuthorStoryEditorStore {
  private readonly repository = inject(AuthorStoryManagementRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly story = signal<AuthorManagedStory | null>(null);
  readonly categories = signal<readonly AuthorStoryMetadataCategory[]>([]);
  readonly tags = signal<readonly AuthorStoryMetadataTag[]>([]);
  readonly coverUrl = signal<string | null>(null);
  readonly contributors = signal<readonly AuthorStoryContributor[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly workflowBusy = signal(false);
  readonly contributorBusy = signal(false);
  readonly error = signal<string | null>(null);

  load(storyId: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.coverUrl.set(null);

    const story$ = storyId ? this.repository.getStory(storyId) : of(null);
    const contributors$ = storyId ? this.repository.listContributors(storyId) : of([]);

    forkJoin({
      story: story$,
      categories: this.repository.listCategories(),
      tags: this.repository.listTags(),
      contributors: contributors$,
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({
          story,
          categories,
          tags,
          contributors,
        }: {
          story: AuthorManagedStory | null;
          categories: readonly AuthorStoryMetadataCategory[];
          tags: readonly AuthorStoryMetadataTag[];
          contributors: readonly AuthorStoryContributor[];
        }) => {
          this.story.set(story);
          this.categories.set(categories);
          this.tags.set(tags);
          this.contributors.set(contributors);
          this.loadCover(story);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  save(
    storyId: string | null,
    input: AuthorStoryDraftInput,
    coverFile: File | null,
    clearCover: boolean,
  ): Observable<AuthorManagedStory> {
    this.saving.set(true);
    this.error.set(null);

    const request$ = storyId
      ? this.saveExisting(storyId, input, coverFile, clearCover)
      : this.saveNew(input, coverFile);

    return request$.pipe(
      tap((story: AuthorManagedStory) => this.story.set(story)),
      catchError((error: unknown) => {
        this.error.set(getApiErrorMessage(error));
        throw error;
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  submit(storyId: string, authorNote: string): Observable<AuthorManagedStory> {
    return this.runWorkflow(
      this.repository
        .submitStory(storyId, authorNote)
        .pipe(map((publication: AuthorStoryPublication) => publication.story)),
    );
  }

  cancelSubmission(storyId: string): Observable<AuthorManagedStory> {
    return this.runWorkflow(
      this.repository
        .cancelSubmission(storyId)
        .pipe(map((publication: AuthorStoryPublication) => publication.story)),
    );
  }

  clearError(): void {
    this.error.set(null);
  }

  upsertContributor(
    storyId: string,
    input: AuthorStoryContributorInput,
  ): Observable<AuthorStoryContributor> {
    this.contributorBusy.set(true);
    this.error.set(null);
    return this.repository.upsertContributor(storyId, input).pipe(
      tap((saved) =>
        this.contributors.update((contributors) => [
          ...contributors.filter(
            (item) => item.userId !== saved.userId || item.role !== saved.role,
          ),
          saved,
        ]),
      ),
      catchError((error: unknown) => {
        this.error.set(getApiErrorMessage(error));
        throw error;
      }),
      finalize(() => this.contributorBusy.set(false)),
    );
  }

  removeContributor(
    storyId: string,
    contributorUserId: string,
    role: AuthorStoryContributorRole,
  ): Observable<void> {
    this.contributorBusy.set(true);
    this.error.set(null);
    return this.repository.removeContributor(storyId, contributorUserId, role).pipe(
      tap(() =>
        this.contributors.update((contributors) =>
          contributors.filter(
            (item) => item.userId !== contributorUserId || item.role !== role,
          ),
        ),
      ),
      catchError((error: unknown) => {
        this.error.set(getApiErrorMessage(error));
        throw error;
      }),
      finalize(() => this.contributorBusy.set(false)),
    );
  }

  private saveNew(
    input: AuthorStoryDraftInput,
    coverFile: File | null,
  ): Observable<AuthorManagedStory> {
    return this.repository.createStory(input).pipe(
      tap((story: AuthorManagedStory) => this.story.set(story)),
      switchMap((story: AuthorManagedStory) => {
        if (!coverFile) return of(story);

        return this.repository.uploadCover(story.id, coverFile).pipe(
          switchMap((media: AuthorStoryMedia) =>
            this.repository
              .updateStory(story.id, {
                ...input,
                coverMediaId: media.id,
              })
              .pipe(tap(() => this.coverUrl.set(media.deliveryUrl))),
          ),
          catchError((error: unknown) => {
            this.coverUrl.set(null);
            this.error.set(
              `Truyện đã được tạo nhưng tải ảnh bìa thất bại. ${getApiErrorMessage(error)}`,
            );
            return of(story);
          }),
        );
      }),
    );
  }

  private saveExisting(
    storyId: string,
    input: AuthorStoryDraftInput,
    coverFile: File | null,
    clearCover: boolean,
  ): Observable<AuthorManagedStory> {
    if (coverFile) {
      return this.repository.uploadCover(storyId, coverFile).pipe(
        switchMap((media: AuthorStoryMedia) =>
          this.repository
            .updateStory(storyId, {
              ...input,
              coverMediaId: media.id,
            })
            .pipe(tap(() => this.coverUrl.set(media.deliveryUrl))),
        ),
      );
    }

    const update: AuthorStoryUpdateInput = clearCover ? { ...input, coverMediaId: null } : input;

    return this.repository.updateStory(storyId, update).pipe(
      tap(() => {
        if (clearCover) this.coverUrl.set(null);
      }),
    );
  }

  private loadCover(story: AuthorManagedStory | null): void {
    if (!story?.coverMediaId) return;

    this.repository
      .getMedia(story.coverMediaId)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((media: AuthorStoryMedia | null) => this.coverUrl.set(media?.deliveryUrl ?? null));
  }

  private runWorkflow(request$: Observable<AuthorManagedStory>): Observable<AuthorManagedStory> {
    this.workflowBusy.set(true);
    this.error.set(null);

    return request$.pipe(
      tap((story: AuthorManagedStory) => this.story.set(story)),
      catchError((error: unknown) => {
        this.error.set(getApiErrorMessage(error));
        throw error;
      }),
      finalize(() => this.workflowBusy.set(false)),
    );
  }
}
