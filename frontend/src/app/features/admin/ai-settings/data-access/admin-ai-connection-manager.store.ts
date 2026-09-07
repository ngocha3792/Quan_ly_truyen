import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AiConnection,
  AiConnectionTestResult,
  AiModelInfo,
  AiUsageSummary,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
} from '../domain/admin-ai-settings.models';
import { AdminAiSettingsApiService } from './admin-ai-settings-api.service';

@Injectable()
export class AdminAiConnectionManagerStore {
  private readonly api = inject(AdminAiSettingsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly connections = signal<readonly AiConnection[]>([]);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly testingId = signal<string | null>(null);
  readonly probingId = signal<string | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly modelBrowserOpen = signal(false);
  readonly modelConnection = signal<AiConnection | null>(null);
  readonly models = signal<readonly AiModelInfo[]>([]);
  readonly modelsLoading = signal(false);
  readonly modelsError = signal('');
  readonly usage = signal<AiUsageSummary | null>(null);
  readonly usageLoading = signal(false);
  readonly usageError = signal('');

  load(): void {
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

  loadUsage(from?: string, to?: string): void {
    if (this.usageLoading()) return;
    this.usageLoading.set(true);
    this.usageError.set('');
    this.api
      .usage(from || undefined, to || undefined)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.usageLoading.set(false)),
      )
      .subscribe({
        next: (usage) => this.usage.set(usage),
        error: (error: unknown) => this.usageError.set(getApiErrorMessage(error)),
      });
  }

  create(payload: CreateAiConnectionPayload, onSuccess: () => void): void {
    this.mutate(this.api.create(payload), 'Đã thêm kết nối AI.', onSuccess);
  }

  update(
    connectionId: string,
    payload: UpdateAiConnectionPayload,
    onSuccess: () => void = () => undefined,
  ): void {
    this.mutate(this.api.update(connectionId, payload), 'Đã cập nhật kết nối.', onSuccess);
  }

  remove(connection: AiConnection): void {
    if (this.mutating() || !window.confirm(`Xóa kết nối "${connection.name}"?`)) return;
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

  test(connection: AiConnection): void {
    if (this.testingId()) return;
    this.testingId.set(connection.id);
    this.error.set('');
    this.message.set('');
    this.api
      .test(connection.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.testingId.set(null)),
      )
      .subscribe({
        next: (result: AiConnectionTestResult) => {
          if (result.ok) {
            this.message.set(`Kết nối "${connection.name}" hoạt động tốt.`);
          } else {
            this.error.set(result.message ?? `Kết nối "${connection.name}" thất bại.`);
          }
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  probe(connection: AiConnection): void {
    if (
      this.probingId() ||
      !window.confirm(
        `Dò khả năng của "${connection.name}" sẽ gửi một số request AI nhỏ và có thể tốn credit. Tiếp tục?`,
      )
    ) {
      return;
    }

    this.probingId.set(connection.id);
    this.error.set('');
    this.message.set('');
    this.api
      .probeCapabilities(connection.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.probingId.set(null)),
      )
      .subscribe({
        next: (result) => {
          this.connections.update((items) =>
            items.map((item) =>
              item.id === connection.id
                ? {
                    ...item,
                    capabilityModel: result.model,
                    capabilities: result.capabilities,
                    capabilitiesProbedAt: result.probedAt,
                  }
                : item,
            ),
          );
          this.message.set(`Đã dò khả năng của "${connection.name}".`);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  openModels(connection: AiConnection): void {
    this.modelConnection.set(connection);
    this.modelBrowserOpen.set(true);
    this.loadModels(connection.id, false);
  }

  refreshModels(): void {
    const connection = this.modelConnection();
    if (connection) this.loadModels(connection.id, true);
  }

  setDefaultModel(model: AiModelInfo): void {
    const connection = this.modelConnection();
    if (!connection || this.mutating()) return;
    this.modelsError.set('');
    this.update(connection.id, { defaultModel: model.id }, () => {
      const updated = { ...connection, defaultModel: model.id };
      this.modelConnection.set(updated);
      this.message.set(`Đã đặt "${model.id}" làm model mặc định.`);
    });
  }

  private mutate(
    request$: Observable<AiConnection>,
    successMessage: string,
    onSuccess: () => void,
  ): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.error.set('');
    this.message.set('');
    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: (connection) => {
          this.connections.update((items) => {
            const exists = items.some((item) => item.id === connection.id);
            return exists
              ? items.map((item) => (item.id === connection.id ? connection : item))
              : [connection, ...items];
          });
          this.message.set(successMessage);
          onSuccess();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private loadModels(connectionId: string, refresh: boolean): void {
    this.models.set([]);
    this.modelsLoading.set(true);
    this.modelsError.set('');
    this.api
      .listModels(connectionId, refresh)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.modelConnection()?.id === connectionId) this.modelsLoading.set(false);
        }),
      )
      .subscribe({
        next: (models) => {
          if (this.modelConnection()?.id === connectionId) this.models.set(models);
        },
        error: (error: unknown) => {
          if (this.modelConnection()?.id === connectionId) {
            this.modelsError.set(getApiErrorMessage(error));
          }
        },
      });
  }
}
