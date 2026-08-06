import {
    Injectable,
} from '@angular/core';

import {
    delay,
    Observable,
    of,
} from 'rxjs';

import {
    StoryRankingItem,
    StoryRankingMetric,
    StoryRankingOverview,
    StoryRankingPeriod,
    StoryRankingQuery,
} from '../domain/story-ranking.models';

import {
    GENRE_RANKING_DISTRIBUTION_MOCK,
    STORY_RANKING_ITEMS_MOCK,
} from '../mock/story-ranking.mock';

import { StoryRankingRepository } from './story-ranking.repository';

@Injectable()
export class StoryRankingMockRepository
    implements StoryRankingRepository {
    getOverview(
        query: StoryRankingQuery,
    ): Observable<StoryRankingOverview> {
        const factor =
            getPeriodFactor(
                query.period,
            );

        const items =
            STORY_RANKING_ITEMS_MOCK.map(
                (story) => ({
                    ...story,

                    viewCount:
                        Math.round(
                            story.viewCount *
                            factor,
                        ),

                    ratingCount:
                        Math.round(
                            story.ratingCount *
                            factor,
                        ),

                    followerCount:
                        Math.round(
                            story.followerCount *
                            Math.max(
                                factor,
                                0.35,
                            ),
                        ),
                }),
            );

        const rankedItems =
            sortStories(
                items,
                query.metric,
            )
                .slice(0, query.limit)
                .map(
                    (story, index) => ({
                        ...story,
                        rank: index + 1,
                    }),
                );

        const totalReads =
            rankedItems.reduce(
                (total, story) =>
                    total +
                    story.viewCount,

                0,
            );

        const followerCount =
            rankedItems.reduce(
                (total, story) =>
                    total +
                    story.followerCount,

                0,
            );

        const maximumValue =
            Math.max(
                ...rankedItems.map(
                    (story) =>
                        story.viewCount,
                ),
                1,
            );

        return of({
            items: rankedItems,

            summary: {
                totalReads,

                totalReadsChangePercent:
                    getReadChange(
                        query.period,
                    ),

                hotStoryCount:
                    rankedItems.filter(
                        (story) =>
                            story.popularityScore >=
                            85,
                    ).length,

                hotStoryChange:
                    query.period === 'day'
                        ? 2
                        : 8,

                followerCount,

                followerChangePercent:
                    query.period === 'day'
                        ? 1.2
                        : 5.7,
            },

            genres:
                GENRE_RANKING_DISTRIBUTION_MOCK,

            trends:
                [...rankedItems]
                    .sort(
                        (left, right) =>
                            right.trendingScore -
                            left.trendingScore,
                    )
                    .slice(0, 5)
                    .map((story) => ({
                        id: story.id,
                        slug: story.slug,
                        title: story.title,

                        coverUrl:
                            story.coverUrl,

                        value:
                            story.viewCount,

                        maximumValue,
                    })),

            generatedAt:
                new Date().toISOString(),
        }).pipe(
            delay(320),
        );
    }
}

function sortStories(
    items:
        readonly StoryRankingItem[],

    metric:
        StoryRankingMetric,
): StoryRankingItem[] {
    const result = [...items];

    switch (metric) {
        case 'rating':
            return result.sort(
                (left, right) =>
                    right.rating -
                    left.rating ||
                    right.ratingCount -
                    left.ratingCount,
            );

        case 'followers':
            return result.sort(
                (left, right) =>
                    right.followerCount -
                    left.followerCount,
            );

        case 'trending':
            return result.sort(
                (left, right) =>
                    right.trendingScore -
                    left.trendingScore,
            );

        case 'popular':
        default:
            return result.sort(
                (left, right) =>
                    right.viewCount -
                    left.viewCount,
            );
    }
}

function getPeriodFactor(
    period: StoryRankingPeriod,
): number {
    switch (period) {
        case 'day':
            return 0.14;

        case 'month':
            return 3.2;

        case 'all':
            return 9.5;

        case 'week':
        default:
            return 1;
    }
}

function getReadChange(
    period: StoryRankingPeriod,
): number {
    switch (period) {
        case 'day':
            return 3.8;

        case 'month':
            return 18.4;

        case 'all':
            return 36.2;

        case 'week':
        default:
            return 12.4;
    }
}