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
import { DialogShellComponent } from '../../../../../shared/components/dialog-shell/dialog-shell.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { AdminAiSettingsApiService } from '../../data-access/admin-ai-settings-api.service';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  AiConnection,
  AiProviderId,
} from '../../domain/admin-ai-settings.models';

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
    DialogShellComponent,
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

  protected readonly providers = AI_PROVIDERS;
  protected readonly labels = AI_PROVIDER_LABELS;

  protected readonly connections = signal<readonly AiConnection[]>([]);
  protected readonly loading = signal(false);
  protected readonly mutating = signal(false);
  protected readonly testingId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly editorOpen = signal(false);

  protected editing: AiConnection | null = null;
  protected editName = '';
  protected editProvider: AiProviderId = 'GEMINI';
  protected editApiKey = '';
  protected editBaseUrl = '';
  protected editDefaultModel = '';
  protected editEnabled = true;

  ngOnInit(): void {
    this.load();
  }

  protected get isCompatible(): boolean {
    return this.editProvider === 'OPENAI_COMPATIBLE';
  }

  protected openCreate(): void {
    this.editing = null;
    this.editName = '';
    this.editProvider = 'GEMINI';
    this.editApiKey = '';
    this.editBaseUrl = '';
    this.editDefaultModel = '';
    this.editEnabled = true;
    this.error.set('');
    this.editorOpen.set(true);
  }

  protected openEdit(connection: AiConnection): void {
    this.editing = connection;
    this.editName = connection.name;
    this.editProvider = connection.provider;
    this.editApiKey = '';
    this.editBaseUrl = connection.baseUrl ?? '';
    this.editDefaultModel = connection.defaultModel ?? '';
    this.editEnabled = connection.enabled;
    this.error.set('');
    this.editorOpen.set(true);
  }

  protected saveEditor(): void {
    const name = this.editName.trim();
    if (!name || this.mutating()) return;

    this.mutating.set(true);
    this.error.set('');

    const request$ = this.editing
      ? this.api.update(this.editing.id, {
          name,
          apiKey: this.editApiKey.trim() || undefined,
          baseUrl: this.isCompatible ? this.editBaseUrl.trim() || null : null,
          defaultModel: this.editDefaultModel.trim() || null,
          enabled: this.editEnabled,
        })
      : this.api.create({
          name,
          provider: this.editProvider,
          apiKey: this.editApiKey.trim(),
          baseUrl: this.isCompatible ? this.editBaseUrl.trim() || null : null,
          defaultModel: this.editDefaultModel.trim() || null,
        });

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.editorOpen.set(false);
          this.message.set(this.editing ? 'Đã cập nhật kết nối.' : 'Đã thêm kết nối AI.');
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  protected test(connection: AiConnection): void {
    if (this.testingId()) return;

    this.testingId.set(connection.id);
    this.error.set('');
    this.api
      .test(connection.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.testingId.set(null)),
      )
      .subscribe({
        next: (result) => {
          this.message.set(
            result.ok
              ? `Kết nối "${connection.name}" hoạt động tốt.`
              : (result.message ?? `Kết nối "${connection.name}" thất bại.`),
          );
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  protected remove(connection: AiConnection): void {
    if (this.mutating()) return;
    if (!window.confirm(`Xóa kết nối "${connection.name}"?`)) return;

    this.mutating.set(true);
    this.error.set('');
    this.api
      .remove(connection.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.message.set(`Đã xóa "${connection.name}".`);
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
        next: (result) => this.connections.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}
