import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AiConversationDetail,
  AiConversationSummary,
  AiMessage,
} from '../domain/ai-assistant.models';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';

function pendingId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Injectable()
export class AiAssistantStore {
  private readonly repository = inject(AiAssistantRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly conversations = signal<readonly AiConversationSummary[]>([]);
  readonly conversationsLoading = signal(false);
  readonly creating = signal(false);

  readonly activeConversation = signal<AiConversationDetail | null>(null);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

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

  createConversation(connectionId: string, modelId?: string): void {
    if (this.creating()) return;

    this.creating.set(true);
    this.error.set(null);
    this.repository
      .createConversation(connectionId, modelId)
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
    this.error.set(null);
    this.repository
      .getConversation(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
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

    const streamingMessageId = pendingId();
    const streamingMessage: AiMessage = {
      id: streamingMessageId,
      role: 'ASSISTANT',
      content: '',
      createdAt: new Date().toISOString(),
      pending: true,
    };

    const isPlaceholder = (messageId: string) =>
      messageId === optimisticMessage.id || messageId === streamingMessageId;

    this.sending.set(true);
    this.error.set(null);
    this.activeConversation.set({
      ...conversation,
      messages: [...conversation.messages, optimisticMessage, streamingMessage],
    });

    this.repository
      .sendMessageStream(conversation.id, trimmed)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          const current = this.activeConversation();
          if (!current || current.id !== conversation.id) return;

          if (event.type === 'delta') {
            this.activeConversation.set({
              ...current,
              messages: current.messages.map((message) =>
                message.id === streamingMessageId
                  ? { ...message, content: message.content + event.text }
                  : message,
              ),
            });
            return;
          }

          if (event.type === 'done') {
            this.activeConversation.set({
              ...current,
              messages: [
                ...current.messages.filter((message) => !isPlaceholder(message.id)),
                event.userMessage,
                event.assistantMessage,
              ],
            });
            this.conversations.update((items) =>
              items.map((item) =>
                item.id === conversation.id
                  ? { ...item, updatedAt: event.assistantMessage.createdAt }
                  : item,
              ),
            );
            return;
          }

          this.activeConversation.set({
            ...current,
            messages: current.messages.filter((message) => !isPlaceholder(message.id)),
          });
          this.error.set(event.message);
        },
        error: (error: unknown) => {
          const current = this.activeConversation();
          if (current && current.id === conversation.id) {
            this.activeConversation.set({
              ...current,
              messages: current.messages.filter((message) => !isPlaceholder(message.id)),
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
