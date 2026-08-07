import { computed, inject, Injectable, signal } from '@angular/core';

import { AuthorDirectorySort, AuthorDirectoryView } from '../domain/author-directory.models';
import { AuthorDirectoryRepository } from '../domain/author-directory.repository';

@Injectable()
export class AuthorDirectoryStore {
  private readonly repository = inject(AuthorDirectoryRepository);

  private readonly viewState = signal<AuthorDirectoryView | null>(null);

  readonly view = this.viewState.asReadonly();

  readonly query = signal('');
  readonly sort = signal<AuthorDirectorySort>('featured');

  readonly page = signal(1);
  readonly pageSize = 7;

  readonly followedAuthorIds = signal<readonly string[]>([]);

  readonly filteredAuthors = computed(() => {
    const view = this.viewState();

    if (!view) {
      return [];
    }

    const normalizedQuery = this.query().trim().toLocaleLowerCase('vi');

    const filtered = normalizedQuery
      ? view.authors.filter((author) => {
          const searchSource = [author.name, author.genre, author.description]
            .join(' ')
            .toLocaleLowerCase('vi');

          return searchSource.includes(normalizedQuery);
        })
      : [...view.authors];

    return filtered.sort((first, second) => {
      switch (this.sort()) {
        case 'followers':
          return second.followers - first.followers;

        case 'reads':
          return second.reads - first.reads;

        case 'works':
          return second.works - first.works;

        case 'name':
          return first.name.localeCompare(second.name, 'vi');

        case 'featured':
        default:
          return first.featuredRank - second.featuredRank;
      }
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAuthors().length / this.pageSize)),
  );

  readonly visiblePages = computed(() =>
    Array.from(
      {
        length: this.totalPages(),
      },
      (_, index) => index + 1,
    ),
  );

  readonly authors = computed(() => {
    const startIndex = (this.page() - 1) * this.pageSize;

    return this.filteredAuthors().slice(startIndex, startIndex + this.pageSize);
  });

  readonly resultCount = computed(() => this.filteredAuthors().length);

  load(): void {
    this.viewState.set(this.repository.getDirectory());
  }

  setQuery(query: string): void {
    this.query.set(query);
    this.page.set(1);
  }

  setSort(sort: AuthorDirectorySort): void {
    this.sort.set(sort);
    this.page.set(1);
  }

  setPage(page: number): void {
    const normalizedPage = Math.min(Math.max(page, 1), this.totalPages());

    this.page.set(normalizedPage);
  }

  nextPage(): void {
    this.setPage(this.page() + 1);
  }

  previousPage(): void {
    this.setPage(this.page() - 1);
  }

  toggleFollow(authorId: string): void {
    this.followedAuthorIds.update((currentIds) => {
      if (currentIds.includes(authorId)) {
        return currentIds.filter((id) => id !== authorId);
      }

      return [...currentIds, authorId];
    });
  }
}
