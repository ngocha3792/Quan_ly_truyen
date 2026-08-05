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
    distinctUntilChanged,
    EMPTY,
    finalize,
    forkJoin,
    switchMap,
    tap,
} from 'rxjs';

import { getApiErrorMessage } from '../../../core/http/api-error.util';

import {
    DEFAULT_STORY_CATALOG_FILTER,
    StoryCatalogAdvancedFilter,
    StoryCatalogFilter,
    StoryCatalogPage,
    StoryCatalogQuery,
    StoryCatalogSort,
    StoryCatalogViewMode,
    StoryGenre,
    StoryPublicationStatus,
    StoryRankingItem,
} from '../domain/story-catalog.models';

import { StoryCatalogRepository } from './story-catalog.repository';

const EMPTY_PAGE: StoryCatalogPage = {
    items: [],

    pagination: {
        page: 1,
        pageSize: 12,
        totalItems: 0,
        totalPages: 1,
    },
};

interface SearchTrigger {
    readonly query: StoryCatalogQuery;
    readonly refreshId: number;
}

@Injectable()
export class StoryCatalogStore {
    private readonly repository =
        inject(StoryCatalogRepository);

    private readonly destroyRef =
        inject(DestroyRef);

    private readonly filterState =
        signal<StoryCatalogFilter>(
            DEFAULT_STORY_CATALOG_FILTER,
        );

    private readonly pageState =
        signal<StoryCatalogPage>(
            EMPTY_PAGE,
        );

    private readonly genresState =
        signal<
            readonly StoryGenre[]
        >([]);

    private readonly rankingState =
        signal<
            readonly StoryRankingItem[]
        >([]);

    private readonly loadingState =
        signal(false);

    private readonly referenceLoadingState =
        signal(false);

    private readonly errorState =
        signal<string | null>(null);

    private readonly refreshIdState =
        signal(0);

    readonly filter =
        this.filterState.asReadonly();

    readonly page =
        this.pageState.asReadonly();

    readonly genres =
        this.genresState.asReadonly();

    readonly ranking =
        this.rankingState.asReadonly();

    readonly loading =
        this.loadingState.asReadonly();

    readonly referenceLoading =
        this.referenceLoadingState.asReadonly();

    readonly error =
        this.errorState.asReadonly();

    readonly stories = computed(
        () => this.pageState().items,
    );

    readonly pagination = computed(
        () =>
            this.pageState().pagination,
    );

    readonly hasActiveFilters =
        computed(() => {
            const filter =
                this.filterState();

            return Boolean(
                filter.query.trim() ||
                filter.genre ||
                filter.status !== 'all' ||
                filter.yearFrom !== null ||
                filter.yearTo !== null,
            );
        });

    private readonly searchTrigger =
        computed<SearchTrigger>(() => {
            const filter =
                this.filterState();

            return {
                query: {
                    query: filter.query,

                    genre: filter.genre,
                    status: filter.status,

                    sort: filter.sort,

                    yearFrom:
                        filter.yearFrom,

                    yearTo:
                        filter.yearTo,

                    page: filter.page,
                    pageSize:
                        filter.pageSize,
                },

                refreshId:
                    this.refreshIdState(),
            };
        });

    constructor() {
        this.loadReferenceData();
        this.connectSearch();
    }

    setQuery(query: string): void {
        this.filterState.update(
            (filter) => ({
                ...filter,
                query,
                page: 1,
            }),
        );
    }

    setGenre(
        genre: string | null,
    ): void {
        this.filterState.update(
            (filter) => ({
                ...filter,
                genre,
                page: 1,
            }),
        );
    }

    setStatus(
        status:
            | StoryPublicationStatus
            | 'all',
    ): void {
        this.filterState.update(
            (filter) => ({
                ...filter,
                status,
                page: 1,
            }),
        );
    }

    setSort(
        sort: StoryCatalogSort,
    ): void {
        this.filterState.update(
            (filter) => ({
                ...filter,
                sort,
                page: 1,
            }),
        );
    }

    setViewMode(
        viewMode:
            StoryCatalogViewMode,
    ): void {
        this.filterState.update(
            (filter) => ({
                ...filter,
                viewMode,
            }),
        );
    }

    setPage(page: number): void {
        const pagination =
            this.pagination();

        const safePage = Math.min(
            Math.max(page, 1),
            pagination.totalPages,
        );

        this.filterState.update(
            (filter) => ({
                ...filter,
                page: safePage,
            }),
        );
    }

    applyAdvancedFilter(
        advanced:
            StoryCatalogAdvancedFilter,
    ): void {
        this.filterState.update(
            (filter) => ({
                ...filter,
                ...advanced,
                page: 1,
            }),
        );
    }

    resetFilters(): void {
        const viewMode =
            this.filterState().viewMode;

        this.filterState.set({
            ...DEFAULT_STORY_CATALOG_FILTER,
            viewMode,
        });
    }

    reload(): void {
        this.errorState.set(null);

        this.refreshIdState.update(
            (value) => value + 1,
        );

        this.loadReferenceData();
    }

    clearError(): void {
        this.errorState.set(null);
    }

    private connectSearch(): void {
        toObservable(this.searchTrigger)
            .pipe(
                debounceTime(180),

                distinctUntilChanged(
                    (previous, current) =>
                        JSON.stringify(previous) ===
                        JSON.stringify(current),
                ),

                tap(() => {
                    this.loadingState.set(true);
                    this.errorState.set(null);
                }),

                switchMap((trigger) =>
                    this.repository
                        .search(trigger.query)
                        .pipe(
                            tap((page) => {
                                this.pageState.set(page);

                                if (
                                    page.pagination.page !==
                                    this.filterState().page
                                ) {
                                    this.filterState.update(
                                        (filter) => ({
                                            ...filter,
                                            page:
                                                page.pagination.page,
                                        }),
                                    );
                                }
                            }),

                            catchError(
                                (error: unknown) => {
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
                        ),
                ),

                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe();
    }

    private loadReferenceData(): void {
        this.referenceLoadingState.set(
            true,
        );

        forkJoin({
            genres:
                this.repository.getGenres(),

            ranking:
                this.repository.getRanking(5),
        })
            .pipe(
                finalize(() => {
                    this.referenceLoadingState.set(
                        false,
                    );
                }),

                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe({
                next: ({
                    genres,
                    ranking,
                }) => {
                    this.genresState.set(genres);
                    this.rankingState.set(
                        ranking,
                    );
                },

                error: (error: unknown) => {
                    this.errorState.set(
                        getApiErrorMessage(error),
                    );
                },
            });
    }
}