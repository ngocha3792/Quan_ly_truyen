import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
import { AdminAiConnectionManagerStore } from '../../data-access/admin-ai-connection-manager.store';
import {
  AI_AUTH_TYPE_LABELS,
  AI_AUTH_TYPES,
  AI_CAPABILITY_KEYS,
  AI_CAPABILITY_LABELS,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  AI_PROTOCOL_LABELS,
  AI_PROTOCOLS,
  AiAuthType,
  AiConnection,
  AiProviderId,
  AiProtocol,
  UpdateAiConnectionPayload,
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
  providers: [AdminAiConnectionManagerStore],
  templateUrl: './admin-ai-settings-page.component.html',
  styleUrl: './admin-ai-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAiSettingsPageComponent implements OnInit {
  protected readonly manager = inject(AdminAiConnectionManagerStore);
  protected readonly connections = this.manager.connections;
  protected readonly loading = this.manager.loading;
  protected readonly mutating = this.manager.mutating;
  protected readonly testingId = this.manager.testingId;
  protected readonly probingId = this.manager.probingId;
  protected readonly error = this.manager.error;
  protected readonly message = this.manager.message;
  protected readonly modelBrowserOpen = this.manager.modelBrowserOpen;
  protected readonly modelConnection = this.manager.modelConnection;
  protected readonly models = this.manager.models;
  protected readonly modelsLoading = this.manager.modelsLoading;
  protected readonly modelsError = this.manager.modelsError;
  protected readonly editorOpen = signal(false);
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Trợ lý AI' },
  ];
  protected readonly providers = AI_PROVIDERS;
  protected readonly labels = AI_PROVIDER_LABELS;
  protected readonly authTypes = AI_AUTH_TYPES;
  protected readonly authLabels = AI_AUTH_TYPE_LABELS;
  protected readonly protocols = AI_PROTOCOLS;
  protected readonly protocolLabels = AI_PROTOCOL_LABELS;
  protected readonly capabilityKeys = AI_CAPABILITY_KEYS;
  protected readonly capabilityLabels = AI_CAPABILITY_LABELS;

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

  ngOnInit(): void {
    this.manager.load();
  }

  protected get isAdvanced(): boolean {
    return (
      this.editProvider === 'CUSTOM' ||
      this.editProvider === 'OPENAI_COMPATIBLE' ||
      this.editProvider === 'ANTHROPIC_COMPATIBLE'
    );
  }

  protected get isCustom(): boolean {
    return this.editProvider === 'CUSTOM';
  }

  protected get needsAuthName(): boolean {
    return this.editAuthType === 'API_KEY_HEADER' || this.editAuthType === 'QUERY_PARAM';
  }

  protected get canSaveEditor(): boolean {
    if (!this.editName.trim() || this.mutating()) return false;
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
    this.editAuthType = connection.authType;
    this.editAuthHeaderName = connection.authHeaderName ?? '';
    this.editProtocol = connection.protocol;
    this.error.set('');
    this.editorOpen.set(true);
  }

  protected saveEditor(): void {
    if (!this.canSaveEditor) return;
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
    const close = () => this.editorOpen.set(false);
    if (this.editing) {
      this.manager.update(this.editing.id, payload, close);
    } else {
      this.manager.create(
        {
          ...payload,
          name: this.editName.trim(),
          provider: this.editProvider,
          apiKey: this.editApiKey.trim(),
        },
        close,
      );
    }
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
    this.manager.openModels(connection);
  }

  protected refreshModels(): void {
    this.manager.refreshModels();
  }
}
