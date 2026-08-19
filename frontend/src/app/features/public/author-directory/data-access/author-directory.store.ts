import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthStore } from '../../../../core/auth/auth.store';
import { AuthorFollowApiService, AuthorFollowMutation } from '@core/author-follow';
import { AuthorDirectorySort, AuthorDirectoryView } from '../domain/author-directory.models';
import { AuthorDirectoryRepository } from '../domain/author-directory.repository';

@Injectable()
export class AuthorDirectoryStore {
  private readonly repository = inject(AuthorDirectoryRepository);
  private readonly follows = inject(AuthorFollowApiService);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly viewState = signal<AuthorDirectoryView | null>(null);
  private readonly pendingAuthorIds = signal<readonly string[]>([]);
  readonly pendingAuthorIdsForView = this.pendingAuthorIds.asReadonly();
  readonly view = this.viewState.asReadonly();

  readonly query = signal('');
  readonly sort = signal<AuthorDirectorySort>('featured');
  readonly page = signal(1);
  readonly pageSize = 7;
  readonly followedAuthorIds = signal<readonly string[]>([]);

  readonly filteredAuthors = computed(() => {
    const view = this.viewState();
    if (!view) return [];
    const normalizedQuery = this.query().trim().toLocaleLowerCase('vi');
    const filtered = normalizedQuery
      ? view.authors.filter((author) =>
          [author.name, author.genre, author.description]
            .join(' ')
            .toLocaleLowerCase('vi')
            .includes(normalizedQuery),
        )
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
    Array.from({ length: this.totalPages() }, (_, index) => index + 1),
  );
  readonly authors = computed(() => {
    const startIndex = (this.page() - 1) * this.pageSize;
    return this.filteredAuthors().slice(startIndex, startIndex + this.pageSize);
  });
  readonly resultCount = computed(() => this.filteredAuthors().length);

  constructor() {
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      const authorIds = this.authors().map((author) => author.id);
      if (!authenticated || authorIds.length === 0) {
        if (!authenticated) this.followedAuthorIds.set([]);
        return;
      }
      this.hydrateVisible(authorIds);
    });
  }

  load(): void {
    this.repository
      .getDirectory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((view) => this.viewState.set(view));
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
    this.page.set(Math.min(Math.max(page, 1), this.totalPages()));
  }
  nextPage(): void {
    this.setPage(this.page() + 1);
  }
  previousPage(): void {
    this.setPage(this.page() - 1);
  }
  isFollowPending(authorId: string): boolean {
    return this.pendingAuthorIds().includes(authorId);
  }

  toggleFollow(authorId: string): void {
    if (!this.auth.isAuthenticated() || this.isFollowPending(authorId)) return;
    const wasFollowing = this.followedAuthorIds().includes(authorId);
    const current = this.viewState()?.authors.find((author) => author.id === authorId);
    if (!current) return;

    this.setPending(authorId, true);
    this.setFollowed(authorId, !wasFollowing);
    this.setFollowerCount(authorId, Math.max(0, current.followers + (wasFollowing ? -1 : 1)));

    const request$ = wasFollowing ? this.follows.unfollow(authorId) : this.follows.follow(authorId);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.applyCanonicalFollow(result),
      error: () => {
        this.setFollowed(authorId, wasFollowing);
        this.setFollowerCount(authorId, current.followers);
        this.setPending(authorId, false);
      },
      complete: () => this.setPending(authorId, false),
    });
  }

  private hydrateVisible(authorIds: readonly string[]): void {
    this.follows
      .getFollowing(authorIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const pending = new Set(this.pendingAuthorIds());
          const visible = new Set(authorIds.filter((id) => !pending.has(id)));
          const followedVisible = new Set(
            page.items.map((item) => item.author.id).filter((id) => !pending.has(id)),
          );
          this.followedAuthorIds.update((current) => [
            ...current.filter((id) => !visible.has(id)),
            ...followedVisible,
          ]);
        },
      });
  }

  private applyCanonicalFollow(result: AuthorFollowMutation): void {
    this.setFollowed(result.authorId, result.isFollowing);
    this.setFollowerCount(result.authorId, result.followersCount);
  }

  private setFollowed(authorId: string, followed: boolean): void {
    this.followedAuthorIds.update((current) => {
      const next = current.filter((id) => id !== authorId);
      return followed ? [...next, authorId] : next;
    });
  }

  private setPending(authorId: string, pending: boolean): void {
    this.pendingAuthorIds.update((current) => {
      const next = current.filter((id) => id !== authorId);
      return pending ? [...next, authorId] : next;
    });
  }

  private setFollowerCount(authorId: string, followers: number): void {
    this.viewState.update((view) =>
      view
        ? {
            ...view,
            authors: view.authors.map((author) =>
              author.id === authorId
                ? {
                    ...author,
                    followers,
                    followersLabel: formatFollowers(followers),
                  }
                : author,
            ),
          }
        : view,
    );
  }
}

function formatFollowers(count: number): string {
  return new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count);
}
