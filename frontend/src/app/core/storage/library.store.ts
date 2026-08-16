import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, finalize, Observable, tap } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { ReaderEngagementApiClient } from '../http/reader-engagement-api.client';

@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly api = inject(ReaderEngagementApiClient);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  private readonly idsState = signal<ReadonlySet<string>>(new Set());
  private readonly syncInFlight = signal(false);

  readonly ids = this.idsState.asReadonly();
  readonly loading = this.syncInFlight.asReadonly();
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        untracked(() => this.sync());
      } else if (this.auth.status() === 'anonymous') {
        this.idsState.set(new Set());
      }
    });
  }

  has(storyId: string): boolean {
    return this.idsState().has(storyId);
  }

  toggle(storyId: string): boolean {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/dang-nhap'], {
        queryParams: { returnUrl: this.router.url },
      });
      return false;
    }

    const previous = this.idsState();
    const next = new Set(previous);
    const added = !next.has(storyId);
    if (added) next.add(storyId);
    else next.delete(storyId);
    this.idsState.set(next);
    this.error.set(null);

    const request$: Observable<unknown> = added
      ? this.api.upsertLibrary(storyId)
      : this.api.removeLibrary(storyId);

    request$
      .pipe(
        catchError(() => {
          this.idsState.set(previous);
          this.error.set('Không thể cập nhật thư viện. Vui lòng thử lại.');
          return EMPTY;
        }),
      )
      .subscribe();

    return added;
  }

  sync(): void {
    if (!this.auth.isAuthenticated() || this.syncInFlight()) return;

    this.syncInFlight.set(true);
    this.error.set(null);
    this.api
      .listLibrary()
      .pipe(
        tap((entries) => {
          this.idsState.set(new Set(entries.map((entry) => entry.story.id)));
        }),
        catchError(() => {
          this.error.set('Không thể đồng bộ thư viện.');
          return EMPTY;
        }),
        finalize(() => this.syncInFlight.set(false)),
      )
      .subscribe();
  }
}
