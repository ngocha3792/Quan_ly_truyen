import {
    InjectionToken,
} from '@angular/core';

import {
    Observable,
} from 'rxjs';

import {
    StoryUpdatesOverview,
    StoryUpdatesQuery,
} from '../domain/story-updates.models';

export interface StoryUpdatesEndpoints {
    readonly overview: string;
}

export const STORY_UPDATES_ENDPOINTS =
    new InjectionToken<StoryUpdatesEndpoints>(
        'STORY_UPDATES_ENDPOINTS',
    );

export abstract class StoryUpdatesRepository {
    abstract getOverview(
        query: StoryUpdatesQuery,
    ): Observable<StoryUpdatesOverview>;
}