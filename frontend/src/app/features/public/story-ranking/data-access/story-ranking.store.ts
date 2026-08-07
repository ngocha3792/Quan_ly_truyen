import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import {
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  EMPTY,
  finalize,
  switchMap,
  tap,
} from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';

import {
  DEFAULT_STORY_RANKING_QUERY,
  EMPTY_STORY_RANKING_OVERVIEW,
  StoryRankingMetric,
  StoryRankingOverview,
  StoryRankingPeriod,
  StoryRankingQuery,
} from '../domain/story-ranking.models';

import { StoryRankingRepository } from './story-ranking.repository';

interface RankingRequest {
  readonly query: StoryRankingQuery;

  readonly refreshId: number;
}

@Injectable()
export class StoryRankingStore {
  private readonly repository = inject(StoryRankingRepository);

  private readonly destroyRef = inject(DestroyRef);

  private readonly queryState = signal<StoryRankingQuery>(DEFAULT_STORY_RANKING_QUERY);

  private readonly overviewState = signal<StoryRankingOverview>(EMPTY_STORY_RANKING_OVERVIEW);

  private readonly loadingState = signal(false);

  private readonly errorState = signal<string | null>(null);

  private readonly refreshIdState = signal(0);

  readonly query = this.queryState.asReadonly();

  readonly overview = this.overviewState.asReadonly();

  readonly loading = this.loadingState.asReadonly();

  readonly error = this.errorState.asReadonly();

  readonly stories = computed(() => this.overviewState().items);

  readonly topStories = computed(() => this.stories().slice(0, 3));

  readonly remainingStories = computed(() => this.stories().slice(3));

  readonly summary = computed(() => this.overviewState().summary);

  readonly genres = computed(() => this.overviewState().genres);

  readonly trends = computed(() => this.overviewState().trends);

  readonly hasData = computed(() => this.stories().length > 0);

  private readonly request = computed<RankingRequest>(() => ({
    query: this.queryState(),

    refreshId: this.refreshIdState(),
  }));

  constructor() {
    this.connect();
  }

  setPeriod(period: StoryRankingPeriod): void {
    this.queryState.update((query) => ({
      ...query,
      period,
    }));
  }

  setMetric(metric: StoryRankingMetric): void {
    this.queryState.update((query) => ({
      ...query,
      metric,
    }));
  }

  patchQuery(partial: Partial<StoryRankingQuery>): void {
    this.queryState.update((query) => ({
      ...query,
      ...partial,
    }));
  }

  reload(): void {
    this.errorState.set(null);

    this.refreshIdState.update((value) => value + 1);
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private connect(): void {
    toObservable(this.request)
      .pipe(
        debounceTime(80),

        distinctUntilChanged(
          (previous, current) => JSON.stringify(previous) === JSON.stringify(current),
        ),

        switchMap(({ query }) =>
          defer(() => {
            this.loadingState.set(true);

            this.errorState.set(null);

            return this.repository.getOverview(query).pipe(
              tap((overview) => {
                this.overviewState.set(overview);
              }),

              catchError((error: unknown) => {
                this.errorState.set(getApiErrorMessage(error));

                return EMPTY;
              }),

              finalize(() => {
                this.loadingState.set(false);
              }),
            );
          }),
        ),

        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
