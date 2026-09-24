import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AuthorRevenueSummary,
  CreatePayoutAccountInput,
  PayoutAccount,
  PayoutRequest,
  formatCredits,
  quotePayout,
} from '../../../../core/revenue/revenue.models';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { PageHeadingComponent } from '../../../../shared/components/page-heading/page-heading.component';
import { RevenueStatusComponent } from '../../../../shared/components/revenue-status/revenue-status.component';
import { AuthorRevenueHttpService } from '../data-access/author-revenue-http.service';

@Component({
  selector: 'app-author-revenue-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    BreadcrumbComponent,
    PageHeadingComponent,
    RevenueStatusComponent,
  ],
  templateUrl: './author-revenue-page.component.html',
  styleUrl: './author-revenue-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorRevenuePageComponent implements OnInit {
  private readonly api = inject(AuthorRevenueHttpService);
  private readonly destroyRef = inject(DestroyRef);
  private payoutKey = '';
  private lastPayoutInput = '';
  protected readonly summary = signal<AuthorRevenueSummary | null>(null);
  protected readonly accounts = signal<readonly PayoutAccount[]>([]);
  protected readonly requests = signal<readonly PayoutRequest[]>([]);
  protected readonly verifiedAccounts = computed(() =>
    this.accounts().filter((a) => a.isActive && a.isVerified),
  );
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly format = formatCredits;
  protected readonly breadcrumbs = [
    { label: 'Author Studio', route: '/author-studio/tong-quan' },
    { label: 'Doanh thu & rút tiền' },
  ];
  protected accountForm: CreatePayoutAccountInput = { method: 'BANK_TRANSFER', kycReference: '' };
  protected payoutAmount = '';
  protected payoutAccountId = '';
  protected quote() {
    const policy = this.summary()?.policy;
    return policy ? quotePayout(this.payoutAmount, policy) : null;
  }
  ngOnInit(): void {
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary: this.api.summary(),
      accounts: this.api.payoutAccounts(),
      requests: this.api.payoutRequests(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ summary, accounts, requests }) => {
          this.summary.set(summary);
          this.accounts.set(accounts);
          this.requests.set(requests);
          if (!accounts.some((a) => a.id === this.payoutAccountId && a.isVerified && a.isActive))
            this.payoutAccountId =
              this.verifiedAccounts().find((a) => a.isPrimary)?.id ??
              this.verifiedAccounts()[0]?.id ??
              '';
        },
        error: (e: unknown) =>
          this.error.set(getApiErrorMessage(e, 'Không thể tải dữ liệu doanh thu.')),
      });
  }
  protected submitAccount(): void {
    const form = this.accountForm;
    if (!form.kycReference.trim()) return;
    const input: CreatePayoutAccountInput =
      form.method === 'BANK_TRANSFER'
        ? {
            method: form.method,
            bankName: form.bankName?.trim(),
            accountNumber: form.accountNumber?.trim(),
            accountName: form.accountName?.trim(),
            kycReference: form.kycReference.trim(),
          }
        : {
            method: form.method,
            walletPhone: form.walletPhone?.trim(),
            accountName: form.accountName?.trim(),
            kycReference: form.kycReference.trim(),
          };
    this.run(this.api.createPayoutAccount(input), 'Đã gửi tài khoản để xác minh.', () => {
      this.accountForm = { method: 'BANK_TRANSFER', kycReference: '' };
    });
  }
  protected updateAccount(id: string, input: { isPrimary?: boolean; isActive?: boolean }): void {
    this.run(this.api.updateAccount(id, input), 'Đã cập nhật tài khoản nhận tiền.');
  }
  protected submitPayout(): void {
    const data = this.summary();
    const quote = this.quote();
    if (
      !data?.policy.enabled ||
      !quote ||
      !this.verifiedAccounts().some((a) => a.id === this.payoutAccountId)
    )
      return;
    if (
      BigInt(quote.gross) < BigInt(data.policy.minimumPayoutCredits) ||
      BigInt(quote.gross) > BigInt(data.available)
    ) {
      this.error.set('Số Credit phải đạt mức rút tối thiểu và không vượt số dư có thể rút.');
      return;
    }
    const input = { accountId: this.payoutAccountId, grossAmount: quote.gross };
    const serialized = JSON.stringify(input);
    if (serialized !== this.lastPayoutInput) {
      this.lastPayoutInput = serialized;
      this.payoutKey = globalThis.crypto.randomUUID();
    }
    this.run(
      this.api.createPayoutRequest(input, this.payoutKey),
      'Đã giữ số Credit và gửi yêu cầu chi trả.',
      () => {
        this.payoutAmount = '';
        this.lastPayoutInput = '';
      },
    );
  }
  protected cancel(id: string): void {
    this.run(this.api.cancelPayout(id), 'Đã hủy yêu cầu và trả Credit về số dư có thể rút.');
  }
  private run(
    action: Observable<unknown>,
    message: string,
    complete: () => void = () => undefined,
  ): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);
    action
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
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
