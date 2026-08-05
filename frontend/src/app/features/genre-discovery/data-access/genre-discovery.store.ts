import {
    computed,
    inject,
    Injectable,
    signal,
} from '@angular/core';

import {
    catchError,
    finalize,
    forkJoin,
    throwError,
} from 'rxjs';

import { getApiErrorMessage } from '../../../core/http/api-error.util';

import {
    DEFAULT_GENRE_DISCOVERY_QUERY,
    EMPTY_GENRE_DISCOVERY_DATA,
    GenreDiscoveryData,
    GenreSummary,
} from '../domain/genre-discovery.models';

import { GenreDiscoveryRepository } from './genre-discovery.repository';

@Injectable()
export class GenreDiscoveryStore {
    private readonly repository =
        inject(GenreDiscoveryRepository);

    private readonly dataState =
        signal<GenreDiscoveryData>(
            EMPTY_GENRE_DISCOVERY_DATA,
        );

    private readonly selectedSlugState =
        signal<string | null>(null);

    private readonly loadingState =
        signal(false);

    private readonly errorState =
        signal<string | null>(null);

    private loaded = false;

    readonly data =
        this.dataState.asReadonly();

    readonly selectedSlug =
        this.selectedSlugState.asReadonly();

    readonly loading =
        this.loadingState.asReadonly();

    readonly error =
        this.errorState.asReadonly();

    readonly genres = computed(
        () => this.dataState().genres,
    );

    readonly featured = computed(
        () => this.dataState().featured,
    );

    readonly ranking = computed(
        () => this.dataState().ranking,
    );

    readonly trending = computed(
        () => this.dataState().trending,
    );

    readonly visibleGenres =
        computed(() => {
            const selected =
                this.selectedSlugState();

            if (!selected) {
                return this.genres();
            }

            return this.genres().filter(
                (genre) =>
                    genre.slug === selected,
            );
        });

    readonly selectedGenre =
        computed<GenreSummary | null>(
            () => {
                const selected =
                    this.selectedSlugState();

                if (!selected) {
                    return null;
                }

                return (
                    this.genres().find(
                        (genre) =>
                            genre.slug === selected,
                    ) ?? null
                );
            },
        );

    readonly totalStoryCount =
        computed(() =>
            this.genres().reduce(
                (total, genre) =>
                    total +
                    genre.storyCount,

                0,
            ),
        );

    load(force = false): void {
        if (
            this.loadingState() ||
            (this.loaded && !force)
        ) {
            return;
        }

        this.loadingState.set(true);
        this.errorState.set(null);

        const query =
            DEFAULT_GENRE_DISCOVERY_QUERY;

        forkJoin({
            genres:
                this.repository.getGenres(),

            featured:
                this.repository
                    .getFeaturedGenres(
                        query.featuredLimit,
                    ),

            ranking:
                this.repository.getRanking(
                    query.rankingLimit,
                ),

            trending:
                this.repository.getTrending({
                    trendingLimit:
                        query.trendingLimit,

                    trendingPeriod:
                        query.trendingPeriod,
                }),
        })
            .pipe(
                catchError((error: unknown) => {
                    this.errorState.set(
                        getApiErrorMessage(error),
                    );

                    return throwError(
                        () => error,
                    );
                }),

                finalize(() => {
                    this.loadingState.set(false);
                }),
            )
            .subscribe({
                next: (data) => {
                    this.dataState.set(data);
                    this.loaded = true;
                },
            });
    }

    reload(): void {
        this.load(true);
    }

    selectGenre(
        slug: string | null,
    ): void {
        this.selectedSlugState.set(
            slug,
        );
    }

    clearError(): void {
        this.errorState.set(null);
    }

    randomGenre():
        GenreSummary | null {
        const genres = this.genres();

        if (genres.length === 0) {
            return null;
        }

        const randomIndex =
            Math.floor(
                Math.random() *
                genres.length,
            );

        return genres[randomIndex] ?? null;
    }
}