import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
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

const PAYMENT_KIND_LABELS: Record<PaymentProviderKind, string> = {
  MANUAL_BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  HMAC_SANDBOX: 'HMAC Sandbox',
};

interface ProviderDraft {
  id: string | null;
  code: string;
  kind: PaymentProviderKind;
  displayName: string;
  description: string;
  currency: string;
  enabled: boolean;
  sortOrder: number;
  orderTtlMinutes: number;
  config: Record<string, string>;
}

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
  protected draft = emptyDraft();

  ngOnInit(): void {
    this.store.load();
  }

  protected edit(provider: PaymentProviderConnection): void {
    const config = provider.config;
    this.draft = {
      id: provider.id,
      code: provider.code,
      kind: provider.kind,
      displayName: provider.displayName,
      description: provider.description ?? '',
      currency: provider.currency,
      enabled: provider.enabled,
      sortOrder: provider.sortOrder,
      orderTtlMinutes: provider.orderTtlMinutes ?? 30,
      config: Object.fromEntries(
        Object.entries(config).map(([key, value]) => [key, stringValue(value)]),
      ),
    };
  }

  protected reset(): void {
    this.draft = emptyDraft();
  }

  protected save(): void {
    if (this.saving) return;
    this.saving = true;
    const config = this.draft.config;
    const common = {
      displayName: this.draft.displayName,
      description: this.draft.description,
      config,
      currency: this.draft.currency,
      enabled: this.draft.enabled,
      sortOrder: this.draft.sortOrder,
      orderTtlMinutes: this.draft.orderTtlMinutes,
    };
    const request = this.draft.id
      ? this.api.updateProvider(this.draft.id, common)
      : this.api.createProvider({ ...common, code: this.draft.code, kind: this.draft.kind });
    request
      .pipe(
        finalize(() => {
          this.saving = false;
        }),
      )
      .subscribe({
        next: () => {
          this.reset();
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
    this.draft.config = Object.fromEntries(
      this.kindFields().map((field) => [field.name, field.placeholder ?? '']),
    );
  }
}

function emptyDraft(): ProviderDraft {
  return {
    id: null,
    code: '',
    kind: 'MANUAL_BANK_TRANSFER',
    displayName: '',
    description: '',
    currency: 'VND',
    enabled: false,
    sortOrder: 10,
    orderTtlMinutes: 2880,
    config: { transferNoteTemplate: 'NAP {{reference}}' },
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
