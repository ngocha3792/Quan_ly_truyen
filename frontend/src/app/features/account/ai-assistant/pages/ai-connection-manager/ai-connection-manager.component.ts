import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { DialogShellComponent } from '../../../../../shared/components/dialog-shell/dialog-shell.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { AiConnectionManagerStore } from '../../data-access/ai-connection-manager.store';
import {
  AI_AUTH_TYPE_LABELS,
  AI_AUTH_TYPES,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  AI_PROTOCOL_LABELS,
  AI_PROTOCOLS,
  AiAuthType,
  AiConnection,
  AiModelInfo,
  AiProviderId,
  AiProtocol,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
} from '../../domain/ai-assistant.models';

@Component({
  selector: 'app-ai-connection-manager',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    DialogShellComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    NoticeComponent,
  ],
  templateUrl: './ai-connection-manager.component.html',
  styleUrl: './ai-connection-manager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiConnectionManagerComponent {
  protected readonly store = inject(AiConnectionManagerStore);
  protected readonly providers = AI_PROVIDERS;
  protected readonly labels = AI_PROVIDER_LABELS;
  protected readonly authTypes = AI_AUTH_TYPES;
  protected readonly authLabels = AI_AUTH_TYPE_LABELS;
  protected readonly protocols = AI_PROTOCOLS;
  protected readonly protocolLabels = AI_PROTOCOL_LABELS;
  protected readonly editorOpen = signal(false);
  protected readonly modelBrowserOpen = signal(false);

  protected editing: AiConnection | null = null;
  protected editName = '';
  protected editProvider: AiProviderId = 'GEMINI';
  protected editApiKey = '';
  protected editBaseUrl = '';
  protected editDefaultModel = '';
  protected editEnabled = true;
  protected editAuthType: AiAuthType = 'BEARER';
  protected editAuthHeaderName = '';
  protected editProtocol: AiProtocol = 'GEMINI_GENERATE_CONTENT';

  protected get isCompatible(): boolean {
    return (
      this.editProvider === 'OPENAI_COMPATIBLE' || this.editProvider === 'ANTHROPIC_COMPATIBLE'
    );
  }

  protected get isCustom(): boolean {
    return this.editProvider === 'CUSTOM';
  }

  protected get isAdvanced(): boolean {
    return this.isCompatible || this.isCustom;
  }

  protected get needsAuthName(): boolean {
    return this.editAuthType === 'API_KEY_HEADER' || this.editAuthType === 'QUERY_PARAM';
  }

  protected get canSave(): boolean {
    if (!this.editName.trim() || this.store.mutating()) return false;
    if (!this.editing && !this.editApiKey.trim()) return false;
    if (this.isAdvanced && (!this.editBaseUrl.trim() || !this.editDefaultModel.trim()))
      return false;
    return !this.needsAuthName || Boolean(this.editAuthHeaderName.trim());
  }

  protected openCreate(): void {
    this.editing = null;
    this.editName = '';
    this.editProvider = 'GEMINI';
    this.editApiKey = '';
    this.editBaseUrl = '';
    this.editDefaultModel = '';
    this.editEnabled = true;
    this.editAuthType = 'BEARER';
    this.editAuthHeaderName = '';
    this.editProtocol = 'GEMINI_GENERATE_CONTENT';
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
    this.editAuthType = connection.authType;
    this.editAuthHeaderName = connection.authHeaderName ?? '';
    this.editProtocol = connection.protocol;
    this.editorOpen.set(true);
  }

  protected save(): void {
    if (!this.canSave) return;

    if (this.editing) {
      const payload: UpdateAiConnectionPayload = {
        name: this.editName.trim(),
        apiKey: this.editApiKey.trim() || undefined,
        baseUrl: this.isAdvanced ? this.editBaseUrl.trim() || null : undefined,
        defaultModel: this.editDefaultModel.trim() || null,
        enabled: this.editEnabled,
        authType: this.isAdvanced ? this.editAuthType : undefined,
        authHeaderName: this.isAdvanced ? this.editAuthHeaderName.trim() || null : undefined,
        protocol: this.isCustom ? this.editProtocol : undefined,
      };
      this.store.update(this.editing.id, payload);
    } else {
      const payload: CreateAiConnectionPayload = {
        name: this.editName.trim(),
        provider: this.editProvider,
        apiKey: this.editApiKey.trim(),
        baseUrl: this.isAdvanced ? this.editBaseUrl.trim() || null : undefined,
        defaultModel: this.editDefaultModel.trim() || null,
        authType: this.isAdvanced ? this.editAuthType : undefined,
        authHeaderName: this.isAdvanced ? this.editAuthHeaderName.trim() || null : undefined,
        protocol: this.isCustom ? this.editProtocol : undefined,
      };
      this.store.create(payload);
    }
    this.editorOpen.set(false);
  }

  protected setProvider(provider: AiProviderId): void {
    this.editProvider = provider;
    this.editProtocol =
      provider === 'ANTHROPIC' || provider === 'ANTHROPIC_COMPATIBLE'
        ? 'ANTHROPIC_MESSAGES'
        : provider === 'OPENAI'
          ? 'OPENAI_RESPONSES'
          : provider === 'GEMINI'
            ? 'GEMINI_GENERATE_CONTENT'
            : 'OPENAI_CHAT_COMPLETIONS';
    this.editAuthType =
      provider === 'ANTHROPIC' || provider === 'ANTHROPIC_COMPATIBLE'
        ? 'X_API_KEY'
        : provider === 'GEMINI'
          ? 'QUERY_PARAM'
          : 'BEARER';
    this.editAuthHeaderName = '';
  }

  protected openModels(connection: AiConnection): void {
    this.modelBrowserOpen.set(true);
    this.store.loadModels(connection.id);
  }

  protected refreshModels(): void {
    const connection = this.modelConnection();
    if (connection) this.store.loadModels(connection.id, true);
  }

  protected setDefaultModel(model: AiModelInfo): void {
    const connection = this.modelConnection();
    if (connection) this.store.update(connection.id, { defaultModel: model.id });
  }

  protected modelConnection(): AiConnection | null {
    const connectionId = this.store.modelsConnectionId();
    return this.store.connections().find((connection) => connection.id === connectionId) ?? null;
  }

  protected remove(connection: AiConnection): void {
    if (!window.confirm(`Xóa kết nối "${connection.name}"?`)) return;
    this.store.remove(connection.id);
  }
}
