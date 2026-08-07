import {
    HttpClient,
    HttpParams,
} from '@angular/common/http';

import {
    inject,
    Injectable,
} from '@angular/core';

import {
    forkJoin,
    map,
    Observable,
} from 'rxjs';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import {
    GenreRankingDistribution,
    StoryRankingListResponse,
    StoryRankingOverview,
    StoryRankingQuery,
    StoryRankingSummary,
    StoryRankingTrend,
} from '../domain/story-ranking.models';

import {
    STORY_RANKING_ENDPOINTS,
    StoryRankingRepository,
} from './story-ranking.repository';

@Injectable()
export class StoryRankingHttpRepository
    implements StoryRankingRepository {
    private readonly http =
        inject(HttpClient);

    private readonly endpoints =
        inject(STORY_RANKING_ENDPOINTS);

    getOverview(
        query: StoryRankingQuery,
    ): Observable<StoryRankingOverview> {
        const baseParams =
            new HttpParams().set(
                'period',
                query.period,
            );

        const rankingParams =
            baseParams
                .set('metric', query.metric)
                .set(
                    'limit',
                    String(query.limit),
                );

        const sidebarParams =
            baseParams.set('limit', '5');

        return forkJoin({
            ranking:
                this.http
                    .get<
                        ApiSuccessEnvelope<
                            StoryRankingListResponse
                        >
                    >(
                        this.endpoints.ranking,
                        {
                            params:
                                rankingParams,
                        },
                    )
                    .pipe(
                        map(
                            (response) =>
                                response.data,
                        ),
                    ),

            summary:
                this.http
                    .get<
                        ApiSuccessEnvelope<
                            StoryRankingSummary
                        >
                    >(
                        this.endpoints.summary,
                        {
                            params:
                                baseParams,
                        },
                    )
                    .pipe(
                        map(
                            (response) =>
                                response.data,
                        ),
                    ),

            genres:
                this.http
                    .get<
                        ApiSuccessEnvelope<
                            readonly GenreRankingDistribution[]
                        >
                    >(
                        this.endpoints.genres,
                        {
                            params:
                                sidebarParams,
                        },
                    )
                    .pipe(
                        map(
                            (response) =>
                                response.data,
                        ),
                    ),

            trends:
                this.http
                    .get<
                        ApiSuccessEnvelope<
                            readonly StoryRankingTrend[]
                        >
                    >(
                        this.endpoints.trends,
                        {
                            params:
                                sidebarParams,
                        },
                    )
                    .pipe(
                        map(
                            (response) =>
                                response.data,
                        ),
                    ),
        }).pipe(
            map(
                ({
                    ranking,
                    summary,
                    genres,
                    trends,
                }) => ({
                    items:
                        ranking.items,

                    summary,
                    genres,
                    trends,

                    generatedAt:
                        ranking.generatedAt,
                }),
            ),
        );
    }
}