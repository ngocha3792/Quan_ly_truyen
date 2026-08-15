import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthorDetailView } from '../domain/author-detail.models';
import { AuthorDetailRepository } from '../domain/author-detail.repository';

@Injectable()
export class AuthorDetailStore {
  private readonly repository = inject(AuthorDetailRepository);
  private readonly destroyRef = inject(DestroyRef);

  private readonly viewState = signal<AuthorDetailView | null>(null);

  readonly view = this.viewState.asReadonly();

  readonly isFollowing = signal(false);

  readonly followerLabel = computed(() => {
    const view = this.viewState();

    if (!view) {
      return '';
    }

    return this.isFollowing()
      ? `${view.statistics.followers} · Đang theo dõi`
      : `${view.statistics.followers} người theo dõi`;
  });

  load(slug: string): void {
    this.repository
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((view) => this.viewState.set(view));
  }

  toggleFollow(): void {
    this.isFollowing.update((current) => !current);
  }
}
