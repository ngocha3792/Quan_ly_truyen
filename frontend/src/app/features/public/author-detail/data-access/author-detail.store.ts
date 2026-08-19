import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthStore } from '../../../../core/auth/auth.store';
import { AuthorFollowApiService, AuthorFollowMutation } from '@core/author-follow';
import { AuthorDetailView } from '../domain/author-detail.models';
import { AuthorDetailRepository } from '../domain/author-detail.repository';

@Injectable()
export class AuthorDetailStore {
  private readonly repository = inject(AuthorDetailRepository);
  private readonly follows = inject(AuthorFollowApiService);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly viewState = signal<AuthorDetailView | null>(null);

  readonly view = this.viewState.asReadonly();
  readonly isFollowing = signal(false);
  readonly followPending = signal(false);

  constructor() {
    effect(() => {
      const view = this.viewState();
      const authenticated = this.auth.isAuthenticated();

      if (!view) return;
      if (!authenticated) {
        this.isFollowing.set(false);
        return;
      }
      if (this.followPending()) return;

      this.hydrateFollowState(view.profile.id);
    });
  }

  readonly followerLabel = computed(() => {
    const view = this.viewState();
    if (!view) return '';
    const count = formatFollowers(view.statistics.followersCount);
    return this.isFollowing() ? `${count} · Đang theo dõi` : `${count} người theo dõi`;
  });

  load(slug: string): void {
    this.repository
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((view) => {
        this.viewState.set(view);
        this.isFollowing.set(false);
      });
  }

  toggleFollow(): void {
    const view = this.viewState();
    if (!view || !this.auth.isAuthenticated() || this.followPending()) return;

    const authorId = view.profile.id;
    const wasFollowing = this.isFollowing();
    const previousCount = view.statistics.followersCount;
    this.followPending.set(true);
    this.isFollowing.set(!wasFollowing);
    this.setFollowerCount(Math.max(0, previousCount + (wasFollowing ? -1 : 1)));

    const request$ = wasFollowing ? this.follows.unfollow(authorId) : this.follows.follow(authorId);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.applyCanonicalFollow(result),
      error: () => {
        this.isFollowing.set(wasFollowing);
        this.setFollowerCount(previousCount);
        this.followPending.set(false);
      },
      complete: () => this.followPending.set(false),
    });
  }

  private hydrateFollowState(authorId: string): void {
    if (!this.auth.isAuthenticated()) return;
    this.follows
      .getFollowing([authorId])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (!this.followPending()) {
            this.isFollowing.set(page.items.some((item) => item.author.id === authorId));
          }
        },
        error: () => this.isFollowing.set(false),
      });
  }

  private applyCanonicalFollow(result: AuthorFollowMutation): void {
    this.isFollowing.set(result.isFollowing);
    this.setFollowerCount(result.followersCount);
  }

  private setFollowerCount(count: number): void {
    this.viewState.update((view) =>
      view
        ? {
            ...view,
            statistics: {
              ...view.statistics,
              followersCount: count,
              followers: formatFollowers(count),
            },
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
