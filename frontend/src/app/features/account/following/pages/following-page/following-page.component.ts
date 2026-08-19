import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthorFollowApiService, FollowingAuthorItem } from '@core/author-follow';

@Component({
  selector: 'app-following-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './following-page.component.html',
  styleUrl: './following-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowingPageComponent {
  private readonly api = inject(AuthorFollowApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<readonly FollowingAuthorItem[]>([]);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly loading = signal(false);
  protected readonly pending = signal<readonly string[]>([]);

  constructor() {
    this.load(1);
  }

  protected load(page: number): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api
      .getFollowing(undefined, page, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.page.set(result.pagination.page);
          this.totalPages.set(Math.max(1, result.pagination.totalPages));
        },
        error: () => this.loading.set(false),
        complete: () => this.loading.set(false),
      });
  }

  protected unfollow(authorId: string): void {
    if (this.pending().includes(authorId)) return;
    this.pending.update((ids) => [...ids, authorId]);
    this.api
      .unfollow(authorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          this.items.update((items) => items.filter((item) => item.author.id !== authorId)),
        error: () => this.clearPending(authorId),
        complete: () => this.clearPending(authorId),
      });
  }

  private clearPending(authorId: string): void {
    this.pending.update((ids) => ids.filter((id) => id !== authorId));
  }
}
