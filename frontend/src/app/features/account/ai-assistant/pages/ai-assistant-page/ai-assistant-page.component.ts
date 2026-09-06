import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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
import { provideAiAssistant } from '../../data-access/ai-assistant.providers';
import { AiAssistantStore } from '../../data-access/ai-assistant.store';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  AiKeyStatus,
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
  ],
  providers: [...provideAiAssistant(), AiAssistantStore],
  templateUrl: './ai-assistant-page.component.html',
  styleUrl: './ai-assistant-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantPageComponent implements OnInit {
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Trợ lý AI' },
  ];

  protected readonly providers = AI_PROVIDERS;
  protected readonly labels = AI_PROVIDER_LABELS;

  protected readonly settingsOpen = signal(false);
  protected readonly keyInputs: Record<AiProviderId, string> = {
    GEMINI: '',
    OPENAI: '',
    ANTHROPIC: '',
  };

  protected newConversationProvider: AiProviderId = 'GEMINI';
  protected draft = '';

  protected readonly store = inject(AiAssistantStore);

  ngOnInit(): void {
    this.store.loadKeys();
    this.store.loadConversations();
  }

  protected toggleSettings(): void {
    this.settingsOpen.set(!this.settingsOpen());
  }

  protected keyStatusFor(provider: AiProviderId): AiKeyStatus | null {
    return this.store.keys().find((key) => key.provider === provider) ?? null;
  }

  protected saveKey(provider: AiProviderId): void {
    const apiKey = this.keyInputs[provider].trim();
    if (!apiKey) return;
    this.store.saveKey(provider, apiKey);
    this.keyInputs[provider] = '';
  }

  protected removeKey(provider: AiProviderId): void {
    if (!window.confirm(`Xóa API key ${AI_PROVIDER_LABELS[provider]} của bạn?`)) return;
    this.store.removeKey(provider);
  }

  protected createConversation(): void {
    this.store.createConversation(this.newConversationProvider);
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
