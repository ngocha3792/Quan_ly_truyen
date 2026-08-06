import {
    InjectionToken,
} from '@angular/core';

import {
    Observable,
} from 'rxjs';

import {
    StoryRankingOverview,
    StoryRankingQuery,
} from '../domain/story-ranking.models';

export interface StoryRankingEndpoints {
    readonly ranking: string;
    readonly summary: string;
    readonly genres: string;
    readonly trends: string;
}

export const STORY_RANKING_ENDPOINTS =
    new InjectionToken<StoryRankingEndpoints>(
        'STORY_RANKING_ENDPOINTS',
    );

export abstract class StoryRankingRepository {
    abstract getOverview(
        query: StoryRankingQuery,
    ): Observable<StoryRankingOverview>;
}