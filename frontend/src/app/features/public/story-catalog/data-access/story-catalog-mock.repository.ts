import {
    Injectable,
} from '@angular/core';

import {
    delay,
    Observable,
    of,
} from 'rxjs';

import {
    StoryCatalogItem,
    StoryCatalogPage,
    StoryCatalogQuery,
    StoryGenre,
    StoryRankingItem,
} from '../domain/story-catalog.models';

import {
    STORY_CATALOG_MOCK,
    STORY_GENRES_MOCK,
} from '../mock/story-catalog.mock';

import { StoryCatalogRepository } from './story-catalog.repository';

@Injectable()
export class StoryCatalogMockRepository
    implements StoryCatalogRepository {
    search(
        query: StoryCatalogQuery,
    ): Observable<StoryCatalogPage> {
        let stories = [
            ...STORY_CATALOG_MOCK,
        ];

        const normalizedQuery =
            normalizeText(query.query);

        if (normalizedQuery) {
            stories = stories.filter(
                (story) => {
                    const searchable = normalizeText(
                        [
                            story.title,
                            story.authorName ?? '',
                            story.description ?? '',
                            ...story.genres.map(
                                (genre) => genre.name,
                            ),
                        ].join(' '),
                    );

                    return searchable.includes(
                        normalizedQuery,
                    );
                },
            );
        }

        if (query.genre) {
            stories = stories.filter(
                (story) =>
                    story.genres.some(
                        (genre) =>
                            genre.slug === query.genre,
                    ),
            );
        }

        if (query.status !== 'all') {
            stories = stories.filter(
                (story) =>
                    story.status === query.status,
            );
        }

        if (query.yearFrom !== null) {
            stories = stories.filter(
                (story) =>
                    story.releaseYear >=
                    query.yearFrom!,
            );
        }

        if (query.yearTo !== null) {
            stories = stories.filter(
                (story) =>
                    story.releaseYear <=
                    query.yearTo!,
            );
        }

        stories = sortStories(
            stories,
            query.sort,
        );

        const totalItems =
            stories.length;

        const totalPages = Math.max(
            1,
            Math.ceil(
                totalItems / query.pageSize,
            ),
        );

        const safePage = Math.min(
            query.page,
            totalPages,
        );

        const start =
            (safePage - 1) *
            query.pageSize;

        const items = stories.slice(
            start,
            start + query.pageSize,
        );

        return of({
            items,

            pagination: {
                page: safePage,
                pageSize: query.pageSize,
                totalItems,
                totalPages,
            },
        }).pipe(delay(350));
    }

    getGenres():
        Observable<readonly StoryGenre[]> {
        return of(
            STORY_GENRES_MOCK,
        ).pipe(delay(150));
    }

    getRanking(
        limit: number,
    ): Observable<
        readonly StoryRankingItem[]
    > {
        const ranking =
            [...STORY_CATALOG_MOCK]
                .sort(
                    (left, right) =>
                        right.views - left.views,
                )
                .slice(0, limit)
                .map((story) => ({
                    id: story.id,
                    slug: story.slug,
                    title: story.title,

                    coverUrl: story.coverUrl,
                    genres: story.genres,

                    views: story.views,
                    rating: story.rating,
                }));

        return of(ranking).pipe(
            delay(200),
        );
    }
}

function sortStories(
    stories: readonly StoryCatalogItem[],
    sort:
        StoryCatalogQuery['sort'],
): StoryCatalogItem[] {
    const result = [...stories];

    switch (sort) {
        case 'popular':
            return result.sort(
                (left, right) =>
                    right.views - left.views,
            );

        case 'rating':
            return result.sort(
                (left, right) =>
                    right.rating - left.rating,
            );

        case 'chapter-count':
            return result.sort(
                (left, right) =>
                    right.chapterCount -
                    left.chapterCount,
            );

        case 'oldest':
            return result.sort(
                (left, right) =>
                    new Date(
                        left.updatedAt,
                    ).getTime() -
                    new Date(
                        right.updatedAt,
                    ).getTime(),
            );

        case 'latest':
        default:
            return result.sort(
                (left, right) =>
                    new Date(
                        right.updatedAt,
                    ).getTime() -
                    new Date(
                        left.updatedAt,
                    ).getTime(),
            );
    }
}

function normalizeText(
    value: string,
): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}