import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, Observable, tap, throwError } from 'rxjs';

import { ReaderEngagementApiClient } from '../../../../../core/http/reader-engagement-api.client';
import { ReadingGoal } from '../domain/reading-goal.models';

@Injectable()
export class ReadingGoalStore {
  private readonly api = inject(ReaderEngagementApiClient);
  private readonly goalState = signal<ReadingGoal | null>(null);

  readonly goal = this.goalState.asReadonly();
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getReadingGoal()
      .pipe(
        tap((goal) => this.goalState.set(goal)),
        catchError(() => {
          this.error.set('Không thể tải mục tiêu đọc.');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  save(targetChapters: number): Observable<ReadingGoal> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    return this.api.upsertReadingGoal(targetChapters).pipe(
      tap((goal) => {
        this.goalState.set(goal);
        this.success.set('Đã lưu mục tiêu đọc.');
      }),
      catchError((error: unknown) => {
        this.error.set('Không thể lưu mục tiêu đọc.');
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }
}
