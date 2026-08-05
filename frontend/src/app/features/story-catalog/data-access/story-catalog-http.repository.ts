import {
    HttpClient,
    HttpParams,
} from '@angular/common/http';

import {
    inject,
    Injectable,
} from '@angular/core';

import {
    map,
    Observable,
} from 'rxjs';

import { ApiSuccessEnvelope } from '../../../core/http/api-envelope.model';

import {
    StoryCatalogPage,
    StoryCatalogQuery,
    StoryGenre,
    StoryRankingItem,
} from '../domain/story-catalog.models';

import {
    STORY_CATALOG_ENDPOINTS,
    StoryCatalogRepository,
} from './story-catalog.repository';

@Injectable()
export class StoryCatalogHttpRepository
    implements StoryCatalogRepository {
    private readonly http =
        inject(HttpClient);

    private readonly endpoints =
        inject(STORY_CATALOG_ENDPOINTS);

    search(
        query: StoryCatalogQuery,
    ): Observable<StoryCatalogPage> {
        let params = new HttpParams()
            .set('page', String(query.page))
            .set(
                'pageSize',
                String(query.pageSize),
            )
            .set('sort', query.sort);

        if (query.query.trim()) {
            params = params.set(
                'q',
                query.query.trim(),
            );
        }

        if (query.genre) {
            params = params.set(
                'genre',
                query.genre,
            );
        }

        if (query.status !== 'all') {
            params = params.set(
                'status',
                query.status,
            );
        }

        if (query.yearFrom !== null) {
            params = params.set(
                'yearFrom',
                String(query.yearFrom),
            );
        }

        if (query.yearTo !== null) {
            params = params.set(
                'yearTo',
                String(query.yearTo),
            );
        }

        return this.http
            .get<
                ApiSuccessEnvelope<StoryCatalogPage>
            >(
                this.endpoints.catalog,
                { params },
            )
            .pipe(
                map((response) => response.data),
            );
    }

    getGenres():
        Observable<readonly StoryGenre[]> {
        return this.http
            .get<
                ApiSuccessEnvelope<
                    readonly StoryGenre[]
                >
            >(this.endpoints.genres)
            .pipe(
                map((response) => response.data),
            );
    }

    getRanking(
        limit: number,
    ): Observable<
        readonly StoryRankingItem[]
    > {
        const params =
            new HttpParams().set(
                'limit',
                String(limit),
            );

        return this.http
            .get<
                ApiSuccessEnvelope<
                    readonly StoryRankingItem[]
                >
            >(
                this.endpoints.ranking,
                { params },
            )
            .pipe(
                map((response) => response.data),
            );
    }
}