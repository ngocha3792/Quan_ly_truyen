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
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { AdminAiSettingsApiService } from '../../data-access/admin-ai-settings-api.service';
import {
  AI_PROVIDER_LABELS,
  AiProviderId,
  AiProviderKeyStatus,
} from '../../domain/admin-ai-settings.models';

const PROVIDERS: readonly AiProviderId[] = ['GEMINI', 'OPENAI', 'ANTHROPIC'];

@Component({
  selector: 'app-admin-ai-settings-page',
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbComponent,
    PageHeadingComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    NoticeComponent,
    ButtonComponent,
  ],
  templateUrl: './admin-ai-settings-page.component.html',
  styleUrl: './admin-ai-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAiSettingsPageComponent implements OnInit {
  private readonly api = inject(AdminAiSettingsApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Trợ lý AI' },
  ];

  protected readonly providers = PROVIDERS;
  protected readonly labels = AI_PROVIDER_LABELS;

  protected readonly keys = signal<readonly AiProviderKeyStatus[]>([]);
  protected readonly loading = signal(false);
  protected readonly mutating = signal<AiProviderId | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');

  protected readonly inputValues: Record<AiProviderId, string> = {
    GEMINI: '',
    OPENAI: '',
    ANTHROPIC: '',
  };

  ngOnInit(): void {
    this.load();
  }

  protected statusFor(provider: AiProviderId): AiProviderKeyStatus | null {
    return this.keys().find((key) => key.provider === provider) ?? null;
  }

  protected save(provider: AiProviderId): void {
    const apiKey = this.inputValues[provider].trim();
    if (!apiKey || this.mutating()) return;

    this.mutating.set(provider);
    this.error.set('');
    this.api
      .save(provider, apiKey)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(null)),
      )
      .subscribe({
        next: () => {
          this.inputValues[provider] = '';
          this.message.set(`Đã lưu API key ${AI_PROVIDER_LABELS[provider]}.`);
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  protected remove(provider: AiProviderId): void {
    if (this.mutating()) return;
    if (!window.confirm(`Xóa API key ${AI_PROVIDER_LABELS[provider]} khỏi hệ thống?`)) return;

    this.mutating.set(provider);
    this.error.set('');
    this.api
      .remove(provider)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(null)),
      )
      .subscribe({
        next: () => {
          this.message.set(`Đã xóa API key ${AI_PROVIDER_LABELS[provider]}.`);
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => this.keys.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}
