import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { AdminPaymentApiService } from '../../data-access/admin-payment-api.service';
import { AdminPaymentProvidersStore } from '../../data-access/admin-payment-providers.store';
import {
  PaymentProviderConnection,
  PaymentProviderKind,
  PaymentProviderKindSchema,
} from '../../domain/admin-payment.models';
import {
  emptyProviderDraft,
  editProviderDraft,
  providerWrite,
} from '../../domain/payment-provider-draft';
import { ProviderSetupFieldsComponent } from '../../ui/provider-setup-fields/provider-setup-fields.component';
import { StoryPaymentRolloutComponent } from './story-payment-rollout.component';

const PAYMENT_KIND_LABELS: Record<PaymentProviderKind, string> = {
  MANUAL_BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  HMAC_SANDBOX: 'HMAC Sandbox',
  VNPAY: 'VNPAY',
};

@Component({
  selector: 'app-admin-payment-providers-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BreadcrumbComponent,
    ButtonComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    IconComponent,
    LoadingStateComponent,
    PageHeadingComponent,
    ProviderSetupFieldsComponent,
    StoryPaymentRolloutComponent,
  ],
  providers: [AdminPaymentProvidersStore],
  templateUrl: './admin-payment-providers-page.component.html',
  styleUrl: './admin-payment-providers-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentProvidersPageComponent implements OnInit {
  protected readonly store = inject(AdminPaymentProvidersStore);
  private readonly api = inject(AdminPaymentApiService);
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Phương thức thanh toán' },
  ];
  protected saving = false;
  protected draft = emptyProviderDraft();
  protected readonly saved = signal<PaymentProviderConnection | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.store.load();
  }

  protected edit(provider: PaymentProviderConnection): void {
    this.draft = editProviderDraft(provider, this.kindSchema(provider.kind));
    this.saved.set(provider);
    this.success.set(null);
  }

  protected reset(): void {
    this.draft = emptyProviderDraft();
    this.saved.set(null);
    this.success.set(null);
  }

  protected save(): void {
    if (this.saving || !this.draft.code.trim() || !this.draft.displayName.trim()) return;
    this.saving = true;
    this.store.error.set(null);
    this.success.set(null);
    const { code, kind, ...common } = providerWrite(this.draft, this.kindSchema(this.draft.kind));
    const request = this.draft.id
      ? this.api.updateProvider(this.draft.id, common)
      : this.api.createProvider({ ...common, code, kind, enabled: false });
    request
      .pipe(
        finalize(() => {
          this.saving = false;
        }),
      )
      .subscribe({
        next: (provider) => {
          this.edit(provider);
          this.success.set(
            provider.configurationReady
              ? 'Đã lưu cấu hình. Bạn có thể kích hoạt kết nối.'
              : 'Đã lưu bản nháp. Bổ sung các mục còn thiếu khi có khóa.',
          );
          this.store.load();
        },
        error: (error: unknown) =>
          this.store.error.set(getApiErrorMessage(error, 'Không thể lưu kết nối thanh toán.')),
      });
  }

  protected remove(provider: PaymentProviderConnection): void {
    if (!globalThis.confirm(`Xoá phương thức ${provider.displayName}?`)) return;
    this.api.deleteProvider(provider.id).subscribe({
      next: () => this.store.load(),
      error: (error: unknown) =>
        this.store.error.set(getApiErrorMessage(error, 'Không thể xoá kết nối.')),
    });
  }

  protected kindFields() {
    return this.store.kinds().find((item) => item.kind === this.draft.kind)?.fields ?? [];
  }

  protected kindLabel(kind: PaymentProviderKind): string {
    return PAYMENT_KIND_LABELS[kind];
  }

  protected kindSchema(kind: PaymentProviderKind): PaymentProviderKindSchema | undefined {
    return this.store.kinds().find((item) => item.kind === kind);
  }

  protected enabledProviderCount(): number {
    return this.store.providers().filter((provider) => provider.enabled).length;
  }

  protected changeKind(): void {
    this.draft.enabled = false;
    this.draft.orderTtlMinutes = this.draft.kind === 'MANUAL_BANK_TRANSFER' ? 2880 : 15;
    this.draft.credentials = {};
    this.draft.config = Object.fromEntries(
      this.kindFields()
        .filter((field) => !field.secret)
        .map((field) => [field.name, field.defaultValue ?? '']),
    );
  }
}
