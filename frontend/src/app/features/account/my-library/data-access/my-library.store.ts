import { computed, inject, Injectable, signal } from '@angular/core';

import {
  LibraryFilter,
  LibrarySort,
  LibraryStatistics,
  LibraryStory,
  LibraryViewMode,
  MyLibraryView,
} from '../domain/my-library.models';
import { MyLibraryRepository } from '../domain/my-library.repository';

@Injectable()
export class MyLibraryStore {
  private readonly repository = inject(MyLibraryRepository);

  private readonly viewState = signal<MyLibraryView | null>(null);

  readonly view = this.viewState.asReadonly();

  readonly query = signal('');
  readonly filter = signal<LibraryFilter>('all');

  readonly sort = signal<LibrarySort>('recent');

  readonly viewMode = signal<LibraryViewMode>('grid');

  readonly favoriteIds = signal<readonly string[]>([]);

  readonly storiesWithFavorites = computed(() => {
    const view = this.viewState();

    if (!view) {
      return [];
    }

    const favoriteIds = this.favoriteIds();

    return view.stories.map((story) => ({
      ...story,
      isFavorite: favoriteIds.includes(story.id),
    }));
  });

  readonly filteredStories = computed(() => {
    const normalizedQuery = this.query().trim().toLocaleLowerCase('vi');

    const filtered = this.storiesWithFavorites().filter((story) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [story.title, story.author, ...story.genres]
          .join(' ')
          .toLocaleLowerCase('vi')
          .includes(normalizedQuery);

      return matchesSearch && this.matchesFilter(story);
    });

    return [...filtered].sort((first, second) => {
      switch (this.sort()) {
        case 'progress':
          return second.progress - first.progress;

        case 'title':
          return first.title.localeCompare(second.title, 'vi');

        case 'chapter':
          return second.currentChapter - first.currentChapter;

        case 'recent':
        default:
          return first.lastReadMinutes - second.lastReadMinutes;
      }
    });
  });

  readonly statistics = computed<LibraryStatistics>(() => {
    const stories = this.storiesWithFavorites();

    return {
      total: stories.length,

      reading: stories.filter((story) => story.isReading).length,

      favorites: stories.filter((story) => story.isFavorite).length,

      completed: stories.filter((story) => story.isCompleted).length,
    };
  });

  readonly resultCount = computed(() => this.filteredStories().length);

  load(): void {
    const view = this.repository.getLibrary();

    this.viewState.set(view);

    this.favoriteIds.set(view.stories.filter((story) => story.isFavorite).map((story) => story.id));
  }

  setQuery(query: string): void {
    this.query.set(query);
  }

  setFilter(filter: LibraryFilter): void {
    this.filter.set(filter);
  }

  setSort(sort: LibrarySort): void {
    this.sort.set(sort);
  }

  setViewMode(viewMode: LibraryViewMode): void {
    this.viewMode.set(viewMode);
  }

  toggleFavorite(storyId: string): void {
    this.favoriteIds.update((currentIds) => {
      if (currentIds.includes(storyId)) {
        return currentIds.filter((id) => id !== storyId);
      }

      return [...currentIds, storyId];
    });
  }

  private matchesFilter(story: LibraryStory): boolean {
    switch (this.filter()) {
      case 'reading':
        return story.isReading;

      case 'following':
        return story.isFollowing;

      case 'favorite':
        return story.isFavorite;

      case 'completed':
        return story.isCompleted;

      case 'all':
      default:
        return true;
    }
  }
}
