import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AiConnection,
  AiModelInfo,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
} from '../domain/ai-assistant.models';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';

@Injectable()
export class AiConnectionManagerStore {
  private readonly repository = inject(AiAssistantRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly connections = signal<readonly AiConnection[]>([]);
  readonly loading = signal(false);
  readonly mutating = signal<string | 'new' | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly testingId = signal<string | null>(null);
  readonly models = signal<readonly AiModelInfo[]>([]);
  readonly modelsConnectionId = signal<string | null>(null);
  readonly modelsLoading = signal(false);
  readonly modelsError = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repository
      .listConnections()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (connections) => this.connections.set(connections),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  create(payload: CreateAiConnectionPayload): void {
    if (this.mutating()) return;
    this.beginMutation('new');
    this.repository
      .createConnection(payload)
      .pipe(
        finalize(() => this.mutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (connection) => {
          this.notice.set(`Đã thêm kết nối "${connection.name}".`);
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  update(connectionId: string, payload: UpdateAiConnectionPayload): void {
    if (this.mutating()) return;
    this.beginMutation(connectionId);
    this.repository
      .updateConnection(connectionId, payload)
      .pipe(
        finalize(() => this.mutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (connection) => {
          this.connections.update((items) =>
            items.map((item) => (item.id === connection.id ? connection : item)),
          );
          this.notice.set(`Đã cập nhật kết nối "${connection.name}".`);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  remove(connectionId: string): void {
    if (this.mutating()) return;
    this.beginMutation(connectionId);
    this.repository
      .deleteConnection(connectionId)
      .pipe(
        finalize(() => this.mutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.connections.update((items) => items.filter((item) => item.id !== connectionId));
          this.notice.set('Đã xóa kết nối AI.');
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  test(connection: AiConnection): void {
    if (this.testingId()) return;
    this.testingId.set(connection.id);
    this.error.set(null);
    this.notice.set(null);
    this.repository
      .testConnection(connection.id)
      .pipe(
        finalize(() => this.testingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (result.ok) {
            this.notice.set(`Kết nối "${connection.name}" hoạt động tốt.`);
          } else {
            this.error.set(result.message ?? `Kết nối "${connection.name}" không hoạt động.`);
          }
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  loadModels(connectionId: string, refresh = false): void {
    this.modelsConnectionId.set(connectionId);
    this.models.set([]);
    this.modelsLoading.set(true);
    this.modelsError.set(null);
    this.repository
      .listModels(connectionId, refresh)
      .pipe(
        finalize(() => {
          if (this.modelsConnectionId() === connectionId) this.modelsLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (models) => {
          if (this.modelsConnectionId() === connectionId) this.models.set(models);
        },
        error: (error: unknown) => {
          if (this.modelsConnectionId() === connectionId) {
            this.modelsError.set(getApiErrorMessage(error));
          }
        },
      });
  }

  private beginMutation(id: string | 'new'): void {
    this.mutating.set(id);
    this.error.set(null);
    this.notice.set(null);
  }
}
