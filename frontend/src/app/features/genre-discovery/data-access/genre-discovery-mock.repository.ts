import {
    Injectable,
} from '@angular/core';

import {
    delay,
    Observable,
    of,
} from 'rxjs';

import {
    GenreDiscoveryQuery,
    GenreRankingItem,
    GenreSummary,
    GenreTrendingItem,
} from '../domain/genre-discovery.models';

import {
    GENRE_FEATURED_MOCK,
    GENRE_RANKING_MOCK,
    GENRE_SUMMARIES_MOCK,
    GENRE_TRENDING_MOCK,
} from '../mock/genre-discovery.mock';

import { GenreDiscoveryRepository } from './genre-discovery.repository';

@Injectable()
export class GenreDiscoveryMockRepository
    implements GenreDiscoveryRepository {
    getGenres():
        Observable<readonly GenreSummary[]> {
        return of(
            GENRE_SUMMARIES_MOCK,
        ).pipe(
            delay(260),
        );
    }

    getFeaturedGenres(
        limit: number,
    ): Observable<readonly GenreSummary[]> {
        return of(
            GENRE_FEATURED_MOCK.slice(
                0,
                limit,
            ),
        ).pipe(
            delay(220),
        );
    }

    getRanking(
        limit: number,
    ): Observable<
        readonly GenreRankingItem[]
    > {
        return of(
            GENRE_RANKING_MOCK.slice(
                0,
                limit,
            ),
        ).pipe(
            delay(180),
        );
    }

    getTrending(
        query: Pick<
            GenreDiscoveryQuery,
            'trendingLimit' |
            'trendingPeriod'
        >,
    ): Observable<
        readonly GenreTrendingItem[]
    > {
        return of(
            GENRE_TRENDING_MOCK.slice(
                0,
                query.trendingLimit,
            ),
        ).pipe(
            delay(210),
        );
    }
}