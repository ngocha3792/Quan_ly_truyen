import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
import { AiConnectionManagerStore } from '../../data-access/ai-connection-manager.store';
import { provideAiAssistant } from '../../data-access/ai-assistant.providers';
import { AiAssistantStore } from '../../data-access/ai-assistant.store';
import { AiProfileStore } from '../../data-access/ai-profile.store';
import { AiUsageStore } from '../../data-access/ai-usage.store';
import {
  AI_PROVIDER_LABELS,
  AiFallbackPolicy,
  AiModelInfo,
} from '../../domain/ai-assistant.models';
import { AiConnectionManagerComponent } from '../ai-connection-manager/ai-connection-manager.component';

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
    AiConnectionManagerComponent,
  ],
  providers: [
    ...provideAiAssistant(),
    AiAssistantStore,
    AiConnectionManagerStore,
    AiProfileStore,
    AiUsageStore,
  ],
  templateUrl: './ai-assistant-page.component.html',
  styleUrl: './ai-assistant-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantPageComponent implements OnInit {
  protected readonly labels = AI_PROVIDER_LABELS;
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Trợ lý AI' },
  ];
  protected readonly settingsOpen = signal(false);
  protected readonly store = inject(AiAssistantStore);
  protected readonly connectionStore = inject(AiConnectionManagerStore);
  protected readonly profileStore = inject(AiProfileStore);
  protected readonly usageStore = inject(AiUsageStore);

  protected newConversationConnectionId = '';
  protected newConversationModelId = '';
  protected draft = '';
  protected profileModel = '';
  protected profileSystemPrompt = '';
  protected profileLanguage = 'en';
  protected profileAutoTranslate = false;
  protected usageFrom = '';
  protected usageTo = '';

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
      const models = this.connectionStore.models();
      if (
        this.connectionStore.modelsConnectionId() === this.newConversationConnectionId &&
        !this.newConversationModelId &&
        models.length > 0
      ) {
        this.newConversationModelId = models[0].id;
      }
    });
  }

  ngOnInit(): void {
    this.connectionStore.load();
    this.store.loadConversations();
    this.profileStore.loadPolicy();
    this.profileStore.loadProfile();
    this.usageStore.load();
  }

  protected loadUsage(): void {
    this.usageStore.load(this.usageFrom, this.usageTo);
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  protected toggleSettings(): void {
    this.settingsOpen.set(!this.settingsOpen());
  }

  protected setFallbackPolicy(value: string): void {
    if (value === 'NONE' || value === 'SYSTEM') {
      this.profileStore.updateFallbackPolicy(value as AiFallbackPolicy);
    }
  }

  protected saveProfile(): void {
    this.profileStore.updateProfile({
      model: this.profileModel.trim() || null,
      systemPrompt: this.profileSystemPrompt.trim() || null,
      defaultTranslationLanguageCode: this.profileLanguage,
      autoTranslateOnPublish: this.profileAutoTranslate,
    });
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
    const connection = this.connectionStore.connections().find((item) => item.id === connectionId);
    this.newConversationModelId = connection?.defaultModel ?? '';
    if (connectionId) this.connectionStore.loadModels(connectionId);
  }

  protected refreshModels(): void {
    if (this.newConversationConnectionId) {
      this.connectionStore.loadModels(this.newConversationConnectionId, true);
    }
  }

  protected hasSelectedModelOutsideDiscovery(): boolean {
    return (
      Boolean(this.newConversationModelId) &&
      !this.newConversationModels().some((model) => model.id === this.newConversationModelId)
    );
  }

  protected newConversationModels(): readonly AiModelInfo[] {
    return this.connectionStore.modelsConnectionId() === this.newConversationConnectionId
      ? this.connectionStore.models()
      : [];
  }

  protected deleteConversation(conversationId: string, event: Event): void {
    event.stopPropagation();
    if (window.confirm('Xóa cuộc trò chuyện này?')) this.store.deleteConversation(conversationId);
  }

  protected submitMessage(event: Event): void {
    event.preventDefault();
    const content = this.draft;
    this.draft = '';
    this.store.sendMessage(content);
  }
}
