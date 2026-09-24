import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminRevenueHttpService } from '../data-access/admin-revenue-http.service';
import { RevenueAgreement } from '../domain/admin-revenue.models';

@Component({
  selector: 'app-revenue-agreements',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './revenue-agreements.component.html',
  styleUrl: './revenue-agreements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevenueAgreementsComponent {
  private readonly api = inject(AdminRevenueHttpService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly agreements = signal<readonly RevenueAgreement[]>([]);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected storyId = '';
  protected authorPercent = '';
  protected platformPercent = '';
  protected effectiveFrom = '';
  protected contributors: { userId: string; percent: string }[] = [];
  protected load(): void {
    if (!this.storyId.trim() || this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    this.api
      .agreements(this.storyId.trim())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: (v) => this.agreements.set(v),
        error: (e: unknown) => this.error.set(getApiErrorMessage(e, 'Không thể tải thỏa thuận.')),
      });
  }
  protected create(): void {
    const authorShareBps = percentToBasisPoints(this.authorPercent);
    const platformFeeBps = percentToBasisPoints(this.platformPercent);
    const contributorShares = this.contributors.map((c) => ({
      userId: c.userId.trim(),
      shareBps: percentToBasisPoints(c.percent),
    }));
    if (
      authorShareBps < 0 ||
      platformFeeBps < 0 ||
      contributorShares.some((c) => c.shareBps <= 0 || !c.userId) ||
      authorShareBps + platformFeeBps + contributorShares.reduce((s, c) => s + c.shareBps, 0) !==
        10_000
    ) {
      this.error.set('Tổng tỷ lệ tác giả, nền tảng và cộng tác viên phải đúng 100%.');
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .createAgreement({
        storyId: this.storyId.trim(),
        authorShareBps,
        platformFeeBps,
        contributorShares,
        ...(this.effectiveFrom
          ? { effectiveFrom: new Date(this.effectiveFrom).toISOString() }
          : {}),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: (v) => this.agreements.update((rows) => [v, ...rows]),
        error: (e: unknown) =>
          this.error.set(getApiErrorMessage(e, 'Không thể tạo phiên bản thỏa thuận.')),
      });
  }
}
function percentToBasisPoints(value: string): number {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/u.test(value)) return -1;
  const [whole, decimal = ''] = value.split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}
