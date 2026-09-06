import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AiConversationDetail,
  AiConversationSummary,
  AiKeyStatus,
  AiMessage,
  AiProviderId,
} from '../domain/ai-assistant.models';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';

function pendingId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Injectable()
export class AiAssistantStore {
  private readonly repository = inject(AiAssistantRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly keys = signal<readonly AiKeyStatus[]>([]);
  readonly keysLoading = signal(false);
  readonly keysMutating = signal<AiProviderId | null>(null);
  readonly keysError = signal<string | null>(null);

  readonly conversations = signal<readonly AiConversationSummary[]>([]);
  readonly conversationsLoading = signal(false);
  readonly creating = signal(false);

  readonly activeConversation = signal<AiConversationDetail | null>(null);
  readonly messagesLoading = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  loadKeys(): void {
    this.keysLoading.set(true);
    this.keysError.set(null);
    this.repository
      .listKeys()
      .pipe(
        finalize(() => this.keysLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (keys) => this.keys.set(keys),
        error: (error: unknown) => this.keysError.set(getApiErrorMessage(error)),
      });
  }

  saveKey(provider: AiProviderId, apiKey: string): void {
    if (this.keysMutating()) return;

    this.keysMutating.set(provider);
    this.keysError.set(null);
    this.repository
      .saveKey(provider, apiKey)
      .pipe(
        finalize(() => this.keysMutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.loadKeys(),
        error: (error: unknown) => this.keysError.set(getApiErrorMessage(error)),
      });
  }

  removeKey(provider: AiProviderId): void {
    if (this.keysMutating()) return;

    this.keysMutating.set(provider);
    this.keysError.set(null);
    this.repository
      .removeKey(provider)
      .pipe(
        finalize(() => this.keysMutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.loadKeys(),
        error: (error: unknown) => this.keysError.set(getApiErrorMessage(error)),
      });
  }

  loadConversations(): void {
    this.conversationsLoading.set(true);
    this.error.set(null);
    this.repository
      .listConversations()
      .pipe(
        finalize(() => this.conversationsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (conversations) => this.conversations.set(conversations),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  createConversation(provider: AiProviderId): void {
    if (this.creating()) return;

    this.creating.set(true);
    this.error.set(null);
    this.repository
      .createConversation(provider)
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (summary) => {
          this.conversations.update((items) => [summary, ...items]);
          this.selectConversation(summary.id);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  selectConversation(conversationId: string): void {
    this.messagesLoading.set(true);
    this.error.set(null);
    this.repository
      .getConversation(conversationId)
      .pipe(
        finalize(() => this.messagesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => this.activeConversation.set(detail),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  deleteConversation(conversationId: string): void {
    this.repository
      .deleteConversation(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.conversations.update((items) => items.filter((item) => item.id !== conversationId));
          if (this.activeConversation()?.id === conversationId) {
            this.activeConversation.set(null);
          }
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  sendMessage(content: string): void {
    const conversation = this.activeConversation();
    const trimmed = content.trim();
    if (!conversation || !trimmed || this.sending()) return;

    const optimisticMessage: AiMessage = {
      id: pendingId(),
      role: 'USER',
      content: trimmed,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    this.sending.set(true);
    this.error.set(null);
    this.activeConversation.set({
      ...conversation,
      messages: [...conversation.messages, optimisticMessage],
    });

    this.repository
      .sendMessage(conversation.id, trimmed)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          const current = this.activeConversation();
          if (!current || current.id !== conversation.id) return;

          this.activeConversation.set({
            ...current,
            messages: [
              ...current.messages.filter((message) => message.id !== optimisticMessage.id),
              result.userMessage,
              result.assistantMessage,
            ],
          });
          this.conversations.update((items) =>
            items.map((item) =>
              item.id === conversation.id
                ? { ...item, updatedAt: result.assistantMessage.createdAt }
                : item,
            ),
          );
        },
        error: (error: unknown) => {
          const current = this.activeConversation();
          if (current && current.id === conversation.id) {
            this.activeConversation.set({
              ...current,
              messages: current.messages.filter((message) => message.id !== optimisticMessage.id),
            });
          }
          this.error.set(getApiErrorMessage(error));
        },
      });
  }

  clearError(): void {
    this.error.set(null);
  }
}
