import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { HomePageData } from '../domain/home.models';
import { HomeRepository } from './home.repository';

@Injectable()
export class HomeStore {
  private readonly repository = inject(HomeRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<HomePageData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeHeroIndex = signal(0);

  readonly activeHero = computed(() => {
    const slides = this.data()?.heroSlides ?? [];
    return slides[this.activeHeroIndex()] ?? null;
  });

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.repository
      .loadHome()
      .pipe(
        tap((data) => {
          this.data.set(data);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.error.set(getApiErrorMessage(err, 'Không thể tải dữ liệu trang chủ.'));
          return of(null);
        }),
      )
      .subscribe();
  }

  nextHero(): void {
    const length = this.data()?.heroSlides.length ?? 0;
    if (length > 0) {
      this.activeHeroIndex.update((index) => (index + 1) % length);
    }
  }

  previousHero(): void {
    const length = this.data()?.heroSlides.length ?? 0;
    if (length > 0) {
      this.activeHeroIndex.update((index) => (index - 1 + length) % length);
    }
  }

  startHeroAutoplay(intervalMs = 7000): void {
    const timer = window.setInterval(() => this.nextHero(), intervalMs);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }
}
