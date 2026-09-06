import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AiConnection,
  AiConversationDetail,
  AiConversationSummary,
  AiMessage,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
} from '../domain/ai-assistant.models';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';

function pendingId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Injectable()
export class AiAssistantStore {
  private readonly repository = inject(AiAssistantRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly connections = signal<readonly AiConnection[]>([]);
  readonly connectionsLoading = signal(false);
  readonly connectionMutating = signal<string | 'new' | null>(null);
  readonly connectionsError = signal<string | null>(null);

  readonly conversations = signal<readonly AiConversationSummary[]>([]);
  readonly conversationsLoading = signal(false);
  readonly creating = signal(false);

  readonly activeConversation = signal<AiConversationDetail | null>(null);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  loadConnections(): void {
    this.connectionsLoading.set(true);
    this.connectionsError.set(null);
    this.repository
      .listConnections()
      .pipe(
        finalize(() => this.connectionsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (connections) => this.connections.set(connections),
        error: (error: unknown) => this.connectionsError.set(getApiErrorMessage(error)),
      });
  }

  createConnection(payload: CreateAiConnectionPayload): void {
    if (this.connectionMutating()) return;

    this.connectionMutating.set('new');
    this.connectionsError.set(null);
    this.repository
      .createConnection(payload)
      .pipe(
        finalize(() => this.connectionMutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.loadConnections(),
        error: (error: unknown) => this.connectionsError.set(getApiErrorMessage(error)),
      });
  }

  updateConnection(connectionId: string, payload: UpdateAiConnectionPayload): void {
    if (this.connectionMutating()) return;

    this.connectionMutating.set(connectionId);
    this.connectionsError.set(null);
    this.repository
      .updateConnection(connectionId, payload)
      .pipe(
        finalize(() => this.connectionMutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.loadConnections(),
        error: (error: unknown) => this.connectionsError.set(getApiErrorMessage(error)),
      });
  }

  deleteConnection(connectionId: string): void {
    if (this.connectionMutating()) return;

    this.connectionMutating.set(connectionId);
    this.connectionsError.set(null);
    this.repository
      .deleteConnection(connectionId)
      .pipe(
        finalize(() => this.connectionMutating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.loadConnections(),
        error: (error: unknown) => this.connectionsError.set(getApiErrorMessage(error)),
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

  createConversation(connectionId: string): void {
    if (this.creating()) return;

    this.creating.set(true);
    this.error.set(null);
    this.repository
      .createConversation(connectionId)
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
