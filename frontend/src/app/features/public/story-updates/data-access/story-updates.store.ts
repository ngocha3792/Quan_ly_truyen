import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    signal,
} from '@angular/core';

import {
    takeUntilDestroyed,
    toObservable,
} from '@angular/core/rxjs-interop';

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
    DEFAULT_STORY_UPDATES_QUERY,
    EMPTY_STORY_UPDATES_OVERVIEW,
    StoryUpdatesOverview,
    StoryUpdatesQuery,
    StoryUpdatesSort,
    StoryUpdatesTab,
} from '../domain/story-updates.models';

import { StoryUpdatesRepository } from './story-updates.repository';

interface StoryUpdatesRequest {
    readonly query:
    StoryUpdatesQuery;

    readonly refreshId: number;
}

@Injectable()
export class StoryUpdatesStore {
    private readonly repository =
        inject(StoryUpdatesRepository);

    private readonly destroyRef =
        inject(DestroyRef);

    private readonly queryState =
        signal<StoryUpdatesQuery>(
            DEFAULT_STORY_UPDATES_QUERY,
        );

    private readonly overviewState =
        signal<StoryUpdatesOverview>(
            EMPTY_STORY_UPDATES_OVERVIEW,
        );

    private readonly loadingState =
        signal(false);

    private readonly errorState =
        signal<string | null>(null);

    private readonly refreshIdState =
        signal(0);

    readonly query =
        this.queryState.asReadonly();

    readonly overview =
        this.overviewState.asReadonly();

    readonly loading =
        this.loadingState.asReadonly();

    readonly error =
        this.errorState.asReadonly();

    readonly featured = computed(
        () =>
            this.overviewState()
                .featured,
    );

    readonly stories = computed(
        () =>
            this.overviewState().items,
    );

    readonly stats = computed(
        () =>
            this.overviewState().stats,
    );

    readonly topUpdates = computed(
        () =>
            this.overviewState()
                .topUpdates,
    );

    readonly schedule = computed(
        () =>
            this.overviewState()
                .schedule,
    );

    readonly popularGenres =
        computed(
            () =>
                this.overviewState()
                    .popularGenres,
        );

    readonly pagination = computed(
        () =>
            this.overviewState()
                .pagination,
    );

    readonly hasData = computed(
        () =>
            this.featured() !== null ||
            this.stories().length > 0,
    );

    private readonly request =
        computed<StoryUpdatesRequest>(
            () => ({
                query:
                    this.queryState(),

                refreshId:
                    this.refreshIdState(),
            }),
        );

    constructor() {
        this.connect();
    }

    setTab(
        tab: StoryUpdatesTab,
    ): void {
        this.queryState.update(
            (query) => ({
                ...query,
                tab,
                page: 1,
            }),
        );
    }

    setSort(
        sort: StoryUpdatesSort,
    ): void {
        this.queryState.update(
            (query) => ({
                ...query,
                sort,
                page: 1,
            }),
        );
    }

    setPage(page: number): void {
        const totalPages =
            this.pagination().totalPages;

        this.queryState.update(
            (query) => ({
                ...query,

                page: Math.min(
                    Math.max(page, 1),
                    totalPages,
                ),
            }),
        );
    }

    patchQuery(
        partial:
            Partial<StoryUpdatesQuery>,
    ): void {
        this.queryState.update(
            (query) => ({
                ...query,
                ...partial,
            }),
        );
    }

    reload(): void {
        this.errorState.set(null);

        this.refreshIdState.update(
            (value) => value + 1,
        );
    }

    clearError(): void {
        this.errorState.set(null);
    }

    private connect(): void {
        toObservable(this.request)
            .pipe(
                debounceTime(80),

                distinctUntilChanged(
                    (previous, current) =>
                        JSON.stringify(
                            previous,
                        ) ===
                        JSON.stringify(
                            current,
                        ),
                ),

                switchMap(
                    ({ query }) =>
                        defer(() => {
                            this.loadingState.set(
                                true,
                            );

                            this.errorState.set(
                                null,
                            );

                            return this.repository
                                .getOverview(query)
                                .pipe(
                                    tap((overview) => {
                                        this.overviewState.set(
                                            overview,
                                        );

                                        if (
                                            query.page !==
                                            overview.pagination
                                                .page
                                        ) {
                                            this.queryState.update(
                                                (current) => ({
                                                    ...current,

                                                    page:
                                                        overview
                                                            .pagination
                                                            .page,
                                                }),
                                            );
                                        }
                                    }),

                                    catchError(
                                        (
                                            error: unknown,
                                        ) => {
                                            this.errorState.set(
                                                getApiErrorMessage(
                                                    error,
                                                ),
                                            );

                                            return EMPTY;
                                        },
                                    ),

                                    finalize(() => {
                                        this.loadingState.set(
                                            false,
                                        );
                                    }),
                                );
                        }),
                ),

                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe();
    }
}