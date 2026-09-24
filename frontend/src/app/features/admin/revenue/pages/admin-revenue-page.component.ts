import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  formatCredits,
  PayoutAccount,
  PayoutBatch,
  PayoutRequest,
  RevenuePolicy,
} from '../../../../core/revenue/revenue.models';
import { PageHeadingComponent } from '../../../../shared/components/page-heading/page-heading.component';
import { RevenueStatusComponent } from '../../../../shared/components/revenue-status/revenue-status.component';
import { AdminRevenueHttpService } from '../data-access/admin-revenue-http.service';
import { RevenueReconciliation } from '../domain/admin-revenue.models';
import { RevenueAgreementsComponent } from './revenue-agreements.component';
import { RevenuePolicyComponent } from '../ui/revenue-policy.component';

@Component({
  selector: 'app-admin-revenue-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PageHeadingComponent,
    RevenueStatusComponent,
    RevenueAgreementsComponent,
    RevenuePolicyComponent,
  ],
  templateUrl: './admin-revenue-page.component.html',
  styleUrl: './admin-revenue-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRevenuePageComponent implements OnInit {
  private readonly api = inject(AdminRevenueHttpService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly policy = signal<RevenuePolicy | null>(null);
  protected readonly accounts = signal<readonly PayoutAccount[]>([]);
  protected readonly requests = signal<readonly PayoutRequest[]>([]);
  protected readonly batches = signal<readonly PayoutBatch[]>([]);
  protected readonly report = signal<RevenueReconciliation | null>(null);
  protected readonly selected = signal<readonly string[]>([]);
  protected readonly pending = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly format = formatCredits;
  protected reviewAccountId = '';
  protected reviewReference = '';
  protected reviewVerified = true;
  protected paymentId = '';
  protected paymentResult: 'complete' | 'fail' = 'complete';
  protected providerTxnId = '';
  protected evidenceReference = '';
  protected failureReason = '';
  ngOnInit(): void {
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      policy: this.api.policy(),
      accounts: this.api.accounts(),
      requests: this.api.requests(),
      batches: this.api.batches(),
      report: this.api.reconciliation(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (data) => {
          this.policy.set(data.policy);
          this.accounts.set(data.accounts);
          this.requests.set(data.requests);
          this.batches.set(data.batches);
          this.report.set(data.report);
          this.selected.update((ids) =>
            ids.filter((id) => data.requests.some((r) => r.id === id && r.status === 'PENDING')),
          );
        },
        error: (e: unknown) =>
          this.error.set(getApiErrorMessage(e, 'Không thể tải dữ liệu doanh thu.')),
      });
  }
  protected savePolicy(value: RevenuePolicy): void {
    this.run(this.api.savePolicy(value), 'Đã lưu chính sách mới.');
  }
  protected select(id: string, checked: boolean): void {
    this.selected.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((v) => v !== id),
    );
  }
  protected createBatch(): void {
    if (this.selected().length)
      this.run(
        this.api.createBatch(this.selected()),
        'Đã tạo lô và giữ các yêu cầu để chi trả.',
        () => this.selected.set([]),
      );
  }
  protected review(account: PayoutAccount): void {
    this.reviewAccountId = account.id;
    this.reviewReference = '';
    this.reviewVerified = true;
  }
  protected submitReview(): void {
    if (!this.reviewAccountId || !this.reviewReference.trim()) return;
    this.run(
      this.api.reviewAccount(this.reviewAccountId, {
        verified: this.reviewVerified,
        reference: this.reviewReference.trim(),
      }),
      'Đã ghi nhận kết quả xác minh.',
      () => {
        this.reviewAccountId = '';
      },
    );
  }
  protected choosePayment(id: string): void {
    this.paymentId = id;
    this.paymentResult = 'complete';
    this.providerTxnId = '';
    this.evidenceReference = '';
    this.failureReason = '';
  }
  protected submitPayment(): void {
    if (!this.paymentId || !this.evidenceReference.trim()) return;
    const action =
      this.paymentResult === 'complete'
        ? this.api.complete(this.paymentId, {
            providerTxnId: this.providerTxnId.trim(),
            evidenceReference: this.evidenceReference.trim(),
          })
        : this.api.fail(this.paymentId, {
            reason: this.failureReason.trim(),
            evidenceReference: this.evidenceReference.trim(),
          });
    this.run(action, 'Đã ghi kết quả chi trả và đối ứng sổ thu nhập.', () => {
      this.paymentId = '';
    });
  }
  protected exportBatch(id: string): void {
    if (this.pending()) return;
    this.pending.set(true);
    this.api
      .exportBatch(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: (data) => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = `payout-batch-${id}.json`;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (e: unknown) => this.error.set(getApiErrorMessage(e, 'Không thể xuất lô chi trả.')),
      });
  }
  private run(
    action: Observable<unknown>,
    message: string,
    complete: () => void = () => undefined,
  ): void {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    this.success.set(null);
    action
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: () => {
          complete();
          this.success.set(message);
          this.load();
        },
        error: (e: unknown) => this.error.set(getApiErrorMessage(e, 'Thao tác chưa thể hoàn tất.')),
      });
  }
}
