import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { PageHeadingComponent } from '../../../../shared/components/page-heading/page-heading.component';
import { RevenueStatusComponent } from '../../../../shared/components/revenue-status/revenue-status.component';
import {
  StatCardComponent,
  StatCardTone,
} from '../../../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { AdminRevenueHttpService } from '../data-access/admin-revenue-http.service';
import { RevenueReconciliation } from '../domain/admin-revenue.models';
import { PayoutBatchesComponent } from '../ui/payout-batches.component';
import { RevenueAgreementsComponent } from './revenue-agreements.component';
import { RevenuePolicyComponent } from '../ui/revenue-policy.component';

interface RevenueStat {
  readonly label: string;
  readonly value: string;
  readonly meta: string;
  readonly icon: IconName;
  readonly tone: StatCardTone;
}

@Component({
  selector: 'app-admin-revenue-page',
  standalone: true,
  imports: [
    BreadcrumbComponent,
    DatePipe,
    FormsModule,
    IconComponent,
    PageHeadingComponent,
    PayoutBatchesComponent,
    RevenueStatusComponent,
    RevenueAgreementsComponent,
    RevenuePolicyComponent,
    StatCardComponent,
    StatusBadgeComponent,
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
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Quản trị', route: '/admin' },
    { label: 'Doanh thu & chi trả' },
  ];
  protected readonly stats = computed<readonly RevenueStat[]>(() => {
    const report = this.report();
    const accounts = this.accounts();
    const waitingAccounts = accounts.filter((a) => a.isActive && !a.isVerified).length;
    const pendingRequests = this.requests().filter((r) => r.status === 'PENDING');
    const pendingCredits = pendingRequests.reduce((sum, r) => sum + toBigInt(r.grossAmount), 0n);
    const grossVnd = report && this.toFiat(report.purchaseGrossCredits);
    return [
      {
        label: 'Doanh thu mua chương',
        value: grossVnd ? `${grossVnd} VND` : '—',
        meta: report ? `${formatCredits(report.purchaseGrossCredits)} Credit` : 'Chưa có số liệu',
        icon: 'wallet',
        tone: 'purple',
      },
      {
        label: 'Chênh lệch đối soát',
        value: report ? `${formatCredits(report.differenceCredits)} Credit` : '—',
        meta: report
          ? `Đã phân bổ ${formatCredits(report.allocatedGrossCredits)} · Đã hoàn ${formatCredits(report.refundedCredits)}`
          : 'Chưa có số liệu',
        icon: 'clock',
        tone: 'orange',
      },
      {
        label: 'Yêu cầu chờ chi trả',
        value: `${pendingRequests.length} yêu cầu`,
        meta: `${formatCredits(pendingCredits.toString())} Credit chờ tạo lô`,
        icon: 'lock',
        tone: 'blue',
      },
      {
        label: 'Tài khoản chờ xác minh',
        value: `${waitingAccounts} tài khoản`,
        meta: `Trên tổng ${accounts.length} tài khoản`,
        icon: 'user',
        tone: 'pink',
      },
    ];
  });
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
        next: (data) => this.download(data, `payout-batch-${id}.json`),
        error: (e: unknown) => this.error.set(getApiErrorMessage(e, 'Không thể xuất lô chi trả.')),
      });
  }
  protected exportReport(): void {
    const report = this.report();
    if (!report) return;
    this.download(
      {
        generatedAt: report.generatedAt,
        reconciliation: report,
        policy: this.policy(),
        payoutRequests: this.requests(),
        payoutBatches: this.batches(),
      },
      `revenue-report-${report.generatedAt.slice(0, 10)}.json`,
    );
  }
  private toFiat(credits: string): string | null {
    const rate = this.policy()?.fiatMinorPerCredit;
    if (!rate || !/^\d+$/u.test(rate) || !/^-?\d+$/u.test(credits)) return null;
    return new Intl.NumberFormat('vi-VN').format(BigInt(credits) * BigInt(rate));
  }
  private download(data: unknown, filename: string): void {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
function toBigInt(value: string): bigint {
  return /^-?\d+$/u.test(value) ? BigInt(value) : 0n;
}
