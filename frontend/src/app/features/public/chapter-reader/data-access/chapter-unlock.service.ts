import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, tap } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ChapterReaderRepository } from './chapter-reader.repository';

@Injectable()
export class ChapterUnlockService {
  private readonly repository = inject(ChapterReaderRepository);

  readonly pending = signal(false);
  readonly message = signal<string | null>(null);

  execute(chapterId: string, onUnlocked: () => void): void {
    if (this.pending()) return;
    this.pending.set(true);
    this.message.set(null);
    this.repository
      .unlockChapter(chapterId)
      .pipe(
        tap(onUnlocked),
        catchError((error) => {
          this.message.set(
            getApiErrorMessage(error, 'Không thể mở khóa chương. Vui lòng thử lại.'),
          );
          return EMPTY;
        }),
        finalize(() => this.pending.set(false)),
      )
      .subscribe();
  }
}
