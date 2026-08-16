import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of } from 'rxjs';

import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { PublicStoryApiItem } from '../../../../core/http/public-stories-api.model';
import { STORY_COVER_PLACEHOLDER } from '../../../../shared/models/story.model';
import { HomePageData, Story } from '../domain/home.models';
import { HomeRepository } from './home.repository';

@Injectable()
export class HomeHttpRepository implements HomeRepository {
  private readonly api = inject(PublicStoriesApiClient);

  loadHome(): Observable<HomePageData> {
    return forkJoin({
      latest: this.api.list({ sort: 'latest', pageSize: 12 }),
      popular: this.api.list({ sort: 'popular', pageSize: 10 }),
      rated: this.api.list({ sort: 'rating', pageSize: 10 }),
    }).pipe(
      map(({ latest, popular, rated }) => {
        const latestStories = latest.items.map(toStory);
        const popularStories = popular.items.map(toStory);
        const ratedStories = rated.items.map(toStory);

        return {
          heroSlides: popular.items
            .filter((story) => story.latestChapter !== null)
            .slice(0, 3)
            .map((story, index) => ({
              id: story.id,
              eyebrow: index === 0 ? 'Nổi bật' : 'Đề xuất',
              title: story.title,
              description: story.synopsis,
              imageUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
              storySlug: story.slug,
              latestChapter: story.latestChapter!.number,
              accent: (['violet', 'blue', 'orange'] as const)[index % 3],
            })),
          quickActions: [
            {
              id: 'latest',
              label: 'Truyện mới cập nhật',
              description: 'Theo dõi các truyện vừa có thay đổi mới.',
              icon: 'clock',
              route: '/cap-nhat',
            },
            {
              id: 'catalog',
              label: 'Danh sách truyện',
              description: 'Khám phá toàn bộ truyện đang phát hành.',
              icon: 'book-open',
              route: '/danh-sach',
            },
            {
              id: 'genres',
              label: 'Thể loại',
              description: 'Tìm truyện theo thể loại yêu thích.',
              icon: 'grid',
              route: '/the-loai',
            },
            {
              id: 'ranking',
              label: 'Xếp hạng',
              description: 'Xem các truyện nổi bật theo dữ liệu hiện tại.',
              icon: 'trophy',
              route: '/xep-hang',
            },
          ],
          latestStories: latestStories.slice(0, 8),
          recommendedStories: ratedStories.slice(0, 8),
          topStories: popularStories.slice(0, 8),
          recentUpdates: latestStories.slice(0, 8),
        } satisfies HomePageData;
      }),
    );
  }

  findStoryBySlug(slug: string): Observable<Story | null> {
    return this.api.detail(slug).pipe(map(toStory));
  }

  searchStories(query: string, limit = 6): Observable<readonly Story[]> {
    const normalized = query.trim();
    if (!normalized) {
      return of([]);
    }

    return this.api
      .list({ q: normalized, pageSize: Math.min(Math.max(limit, 1), 100) })
      .pipe(map((page) => page.items.map(toStory)));
  }
}

function toStory(story: PublicStoryApiItem): Story {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    author: story.author.penName,
    description: story.synopsis,
    coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
    categories: story.categories.map((category) => category.name),
    latestChapter: story.latestChapter
      ? {
          number: story.latestChapter.number,
          title: story.latestChapter.title,
          slug: story.latestChapter.slug,
          updatedAt: story.latestChapter.publishedAt,
        }
      : null,
    views: story.stats.views,
    rating: story.stats.ratingAverage,
    chapterCount: story.stats.chapters,
    status: story.status,
    badge: story.status === 'COMPLETED' ? 'FULL' : undefined,
  };
}
