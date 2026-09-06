import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { DialogShellComponent } from '../../../../../shared/components/dialog-shell/dialog-shell.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { provideAiAssistant } from '../../data-access/ai-assistant.providers';
import { AiAssistantStore } from '../../data-access/ai-assistant.store';
import { AiProfileStore } from '../../data-access/ai-profile.store';
import {
  AI_AUTH_TYPE_LABELS,
  AI_AUTH_TYPES,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  AiAuthType,
  AiConnection,
  AiFallbackPolicy,
  AiProviderId,
} from '../../domain/ai-assistant.models';

@Component({
  selector: 'app-ai-assistant-page',
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbComponent,
    PageHeadingComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    DialogShellComponent,
  ],
  providers: [...provideAiAssistant(), AiAssistantStore, AiProfileStore],
  templateUrl: './ai-assistant-page.component.html',
  styleUrl: './ai-assistant-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantPageComponent implements OnInit {
  protected readonly providers = AI_PROVIDERS;
  protected readonly labels = AI_PROVIDER_LABELS;
  protected readonly authTypes = AI_AUTH_TYPES;
  protected readonly authLabels = AI_AUTH_TYPE_LABELS;

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Trợ lý AI' },
  ];

  protected readonly settingsOpen = signal(false);
  protected readonly editorOpen = signal(false);

  protected editing: AiConnection | null = null;
  protected editName = '';
  protected editProvider: AiProviderId = 'GEMINI';
  protected editApiKey = '';
  protected editBaseUrl = '';
  protected editDefaultModel = '';
  protected editEnabled = true;
  protected editAuthType: AiAuthType = 'BEARER';
  protected editAuthHeaderName = '';

  protected newConversationConnectionId = '';
  protected newConversationModelId = '';
  protected draft = '';
  protected profileModel = '';
  protected profileSystemPrompt = '';
  protected profileLanguage = 'en';
  protected profileAutoTranslate = false;

  protected readonly store = inject(AiAssistantStore);
  protected readonly profileStore = inject(AiProfileStore);

  constructor() {
    effect(() => {
      const profile = this.profileStore.profile();
      if (!profile) return;
      this.profileModel = profile.model ?? '';
      this.profileSystemPrompt = profile.systemPrompt ?? '';
      this.profileLanguage = profile.defaultTranslationLanguageCode;
      this.profileAutoTranslate = profile.autoTranslateOnPublish;
    });
    effect(() => {
      const models = this.store.models();
      if (
        this.store.modelsConnectionId() === this.newConversationConnectionId &&
        !this.newConversationModelId &&
        models.length > 0
      ) {
        this.newConversationModelId = models[0].id;
      }
    });
  }

  ngOnInit(): void {
    this.store.loadConnections();
    this.store.loadConversations();
    this.profileStore.loadPolicy();
    this.profileStore.loadProfile();
  }

  protected get isCompatible(): boolean {
    return (
      this.editProvider === 'OPENAI_COMPATIBLE' || this.editProvider === 'ANTHROPIC_COMPATIBLE'
    );
  }

  protected get needsAuthName(): boolean {
    return this.editAuthType === 'API_KEY_HEADER' || this.editAuthType === 'QUERY_PARAM';
  }

  protected get canSaveConnection(): boolean {
    if (!this.editName.trim()) return false;
    if (!this.editing && !this.editApiKey.trim()) return false;
    if (this.isCompatible && (!this.editBaseUrl.trim() || !this.editDefaultModel.trim())) {
      return false;
    }
    return !this.needsAuthName || Boolean(this.editAuthHeaderName.trim());
  }

  protected toggleSettings(): void {
    this.settingsOpen.set(!this.settingsOpen());
  }

  protected setFallbackPolicy(value: string): void {
    if (value !== 'NONE' && value !== 'SYSTEM') return;
    this.profileStore.updateFallbackPolicy(value as AiFallbackPolicy);
  }

  protected saveProfile(): void {
    this.profileStore.updateProfile({
      model: this.profileModel.trim() || null,
      systemPrompt: this.profileSystemPrompt.trim() || null,
      defaultTranslationLanguageCode: this.profileLanguage,
      autoTranslateOnPublish: this.profileAutoTranslate,
    });
  }

  protected openCreateConnection(): void {
    this.editing = null;
    this.editName = '';
    this.editProvider = 'GEMINI';
    this.editApiKey = '';
    this.editBaseUrl = '';
    this.editDefaultModel = '';
    this.editEnabled = true;
    this.editAuthType = 'BEARER';
    this.editAuthHeaderName = '';
    this.editorOpen.set(true);
  }

  protected openEditConnection(connection: AiConnection): void {
    this.editing = connection;
    this.editName = connection.name;
    this.editProvider = connection.provider;
    this.editApiKey = '';
    this.editBaseUrl = connection.baseUrl ?? '';
    this.editDefaultModel = connection.defaultModel ?? '';
    this.editEnabled = connection.enabled;
    this.editAuthType = connection.authType;
    this.editAuthHeaderName = connection.authHeaderName ?? '';
    this.editorOpen.set(true);
  }

  protected saveConnection(): void {
    const name = this.editName.trim();
    if (!this.canSaveConnection) return;

    if (this.editing) {
      this.updateAndClose(this.editing.id, {
        name,
        apiKey: this.editApiKey.trim() || undefined,
        baseUrl: this.isCompatible ? this.editBaseUrl.trim() || null : undefined,
        defaultModel: this.editDefaultModel.trim() || null,
        enabled: this.editEnabled,
        authType: this.isCompatible ? this.editAuthType : undefined,
        authHeaderName: this.isCompatible ? this.editAuthHeaderName.trim() || null : undefined,
      });
      return;
    }

    this.store.createConnection({
      name,
      provider: this.editProvider,
      apiKey: this.editApiKey.trim(),
      baseUrl: this.isCompatible ? this.editBaseUrl.trim() || null : null,
      defaultModel: this.editDefaultModel.trim() || null,
      authType: this.isCompatible ? this.editAuthType : undefined,
      authHeaderName: this.isCompatible ? this.editAuthHeaderName.trim() || null : undefined,
    });
    this.editorOpen.set(false);
  }

  protected setProvider(provider: AiProviderId): void {
    this.editProvider = provider;
    this.editAuthType = provider === 'ANTHROPIC_COMPATIBLE' ? 'X_API_KEY' : 'BEARER';
    this.editAuthHeaderName = '';
  }

  private updateAndClose(
    connectionId: string,
    payload: Parameters<AiAssistantStore['updateConnection']>[1],
  ): void {
    this.store.updateConnection(connectionId, payload);
    this.editorOpen.set(false);
  }

  protected removeConnection(connection: AiConnection, event: Event): void {
    event.stopPropagation();
    if (!window.confirm(`Xóa kết nối "${connection.name}"?`)) return;
    this.store.deleteConnection(connection.id);
  }

  protected createConversation(): void {
    if (!this.newConversationConnectionId) return;
    this.store.createConversation(
      this.newConversationConnectionId,
      this.newConversationModelId.trim() || undefined,
    );
  }

  protected selectConversationConnection(connectionId: string): void {
    this.newConversationConnectionId = connectionId;
    const connection = this.store.connections().find((item) => item.id === connectionId);
    this.newConversationModelId = connection?.defaultModel ?? '';
    if (connectionId) this.store.loadModels(connectionId);
  }

  protected refreshModels(): void {
    if (this.newConversationConnectionId) {
      this.store.loadModels(this.newConversationConnectionId, true);
    }
  }

  protected hasSelectedModelOutsideDiscovery(): boolean {
    return (
      Boolean(this.newConversationModelId) &&
      !this.store.models().some((model) => model.id === this.newConversationModelId)
    );
  }

  protected deleteConversation(conversationId: string, event: Event): void {
    event.stopPropagation();
    if (!window.confirm('Xóa cuộc trò chuyện này?')) return;
    this.store.deleteConversation(conversationId);
  }

  protected submitMessage(event: Event): void {
    event.preventDefault();
    const content = this.draft;
    this.draft = '';
    this.store.sendMessage(content);
  }
}
