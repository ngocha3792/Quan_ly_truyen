import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import type { AiUsageSummary } from '../domain/ai-assistant.models';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';

@Injectable()
export class AiUsageStore {
  private readonly repository = inject(AiAssistantRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly summary = signal<AiUsageSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(from?: string, to?: string): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.repository
      .getUsage(from || undefined, to || undefined)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}
