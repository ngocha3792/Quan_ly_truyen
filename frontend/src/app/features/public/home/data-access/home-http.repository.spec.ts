import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import type {
  PublicStoryApiItem,
  PublicStoryListParams,
} from '../../../../core/http/public-stories-api.model';
import { HomeHttpRepository } from './home-http.repository';

describe('HomeHttpRepository recommendations', () => {
  const latest = story('latest', 4.1, 10);
  const popular = story('popular', 4.2, 20);
  const recommended = story('recommended', 4.8, 80);
  let api: {
    list: ReturnType<typeof vi.fn>;
    recommendations: ReturnType<typeof vi.fn>;
  };
  let repository: HomeHttpRepository;

  beforeEach(() => {
    api = {
      list: vi.fn((params: PublicStoryListParams) =>
        of(page(params.sort === 'popular' ? [popular] : [latest])),
      ),
      recommendations: vi.fn(() =>
        of({
          personalized: true,
          items: [
            {
              story: recommended,
              reasonCode: 'PREFERRED_CATEGORY' as const,
              reason: 'Vì bạn thường đọc Tiên hiệp',
              matchedCategories: ['Tiên hiệp'],
            },
          ],
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [HomeHttpRepository, { provide: PublicStoriesApiClient, useValue: api }],
    });
    repository = TestBed.inject(HomeHttpRepository);
  });

  it('maps the explainable personalized feed into homepage cards', async () => {
    const result = await firstValueFrom(repository.loadHome());

    expect(api.recommendations).toHaveBeenCalledWith(8);
    expect(result.recommendationsPersonalized).toBe(true);
    expect(result.recommendedStories[0]).toMatchObject({
      id: 'recommended',
      recommendationReason: 'Vì bạn thường đọc Tiên hiệp',
    });
  });

  it('falls back to rating order when the recommendation endpoint fails', async () => {
    api.recommendations.mockReturnValueOnce(throwError(() => new Error('temporarily unavailable')));
    api.list.mockImplementation((params: PublicStoryListParams) => {
      if (params.sort === 'rating') return of(page([recommended]));
      return of(page(params.sort === 'popular' ? [popular] : [latest]));
    });

    const result = await firstValueFrom(repository.loadHome());

    expect(result.recommendationsPersonalized).toBe(false);
    expect(result.recommendedStories[0]?.recommendationReason).toBe('Được đánh giá 4.8/5');
  });
});

function page(items: readonly PublicStoryApiItem[]) {
  return {
    items,
    pagination: { page: 1, pageSize: 10, totalItems: items.length, totalPages: 1 },
  };
}

function story(id: string, ratingAverage: number, ratingCount: number): PublicStoryApiItem {
  return {
    id,
    slug: id,
    title: `Story ${id}`,
    synopsis: 'Synopsis',
    languageCode: 'vi',
    contentRating: 'TEEN',
    releaseYear: 2026,
    status: 'ONGOING',
    author: { id: `author-${id}`, penName: 'Tác giả', slug: `author-${id}` },
    coverUrl: null,
    categories: [{ id: 'fantasy', name: 'Tiên hiệp', slug: 'tien-hiep', isPrimary: true }],
    tags: [],
    latestChapter: {
      id: `chapter-${id}`,
      number: 1,
      title: 'Chương 1',
      slug: 'chuong-1',
      publishedAt: '2026-09-07T00:00:00.000Z',
    },
    stats: {
      views: 100,
      followers: 10,
      ratingCount,
      ratingAverage,
      chapters: 1,
      comments: 0,
    },
    publishedAt: '2026-09-01T00:00:00.000Z',
    lastChapterAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
  };
}
