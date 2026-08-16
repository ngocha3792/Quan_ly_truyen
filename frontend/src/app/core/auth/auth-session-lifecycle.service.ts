import { Injectable, OnDestroy, signal } from '@angular/core';

import { Subject } from 'rxjs';

const AUTH_LIFECYCLE_CHANNEL_NAME = 'truyenhub.auth.lifecycle';

export interface AuthSessionScope {
  readonly userId: string;

  readonly sessionId: string;
}

export type AuthSessionLifecycleKind =
  'session-established' | 'session-cleared' | 'session-invalidated' | 'access-lost';

export interface AuthSessionLifecycleEvent {
  readonly kind: AuthSessionLifecycleKind;

  readonly scope: AuthSessionScope | null;

  readonly reason: string;

  readonly remote: boolean;

  readonly revision: number;
}

type AuthLifecycleBroadcastMessage =
  | {
      readonly type: 'session-established';

      readonly scope: AuthSessionScope;
    }
  | {
      readonly type: 'session-cleared';

      readonly reason: string;
    }
  | {
      readonly type: 'session-invalidated';

      readonly reason: string;
    };

@Injectable({
  providedIn: 'root',
})
export class AuthSessionLifecycleService implements OnDestroy {
  private readonly scopeState = signal<AuthSessionScope | null>(null);

  private readonly revisionState = signal(0);

  private readonly changesSubject = new Subject<AuthSessionLifecycleEvent>();

  private channel: BroadcastChannel | null = null;

  readonly scope = this.scopeState.asReadonly();

  readonly revision = this.revisionState.asReadonly();

  readonly changes$ = this.changesSubject.asObservable();

  constructor() {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(AUTH_LIFECYCLE_CHANNEL_NAME);

      this.channel.addEventListener(
        'message',

        this.handleBroadcastMessage,
      );
    }
  }

  ngOnDestroy(): void {
    if (!this.channel) {
      return;
    }

    this.channel.removeEventListener(
      'message',

      this.handleBroadcastMessage,
    );

    this.channel.close();

    this.channel = null;
  }

  establishSession(
    userId: string,

    sessionId: string,

    broadcast = true,
  ): void {
    const nextScope: AuthSessionScope = {
      userId,

      sessionId,
    };

    const currentScope = this.scopeState();

    if (
      currentScope?.userId === nextScope.userId &&
      currentScope.sessionId === nextScope.sessionId
    ) {
      return;
    }

    this.scopeState.set(nextScope);

    this.emit({
      kind: 'session-established',

      scope: nextScope,

      reason: 'session-established',

      remote: false,
    });

    if (broadcast) {
      this.broadcast({
        type: 'session-established',

        scope: nextScope,
      });
    }
  }

  clearSession(
    reason = 'session-cleared',

    broadcast = true,
  ): void {
    this.scopeState.set(null);

    this.emit({
      kind: 'session-cleared',

      scope: null,

      reason,

      remote: false,
    });

    if (broadcast) {
      this.broadcast({
        type: 'session-cleared',

        reason,
      });
    }
  }

  invalidateSession(
    reason = 'session-invalidated',

    broadcast = true,
  ): void {
    this.scopeState.set(null);

    this.emit({
      kind: 'session-invalidated',

      scope: null,

      reason,

      remote: false,
    });

    if (broadcast) {
      this.broadcast({
        type: 'session-invalidated',

        reason,
      });
    }
  }

  loseAccess(reason = 'access-lost'): void {
    /*
     * Refresh tạm thời thất bại:
     *
     * - không còn access token đáng tin cậy
     * - nhưng refresh cookie có thể vẫn còn hợp lệ
     *
     * Không broadcast event này sang tab khác,
     * vì lỗi mạng/5xx của tab hiện tại không chứng minh
     * phiên của tab khác đã chết.
     */
    this.scopeState.set(null);

    this.emit({
      kind: 'access-lost',

      scope: null,

      reason,

      remote: false,
    });
  }

  private emit(event: Omit<AuthSessionLifecycleEvent, 'revision'>): void {
    this.revisionState.update((revision) => revision + 1);

    this.changesSubject.next({
      ...event,

      revision: this.revisionState(),
    });
  }

  private broadcast(message: AuthLifecycleBroadcastMessage): void {
    this.channel?.postMessage(message);
  }

  private readonly handleBroadcastMessage = (event: MessageEvent<unknown>): void => {
    const message = parseBroadcastMessage(event.data);

    if (!message) {
      return;
    }

    if (message.type === 'session-established') {
      const currentScope = this.scopeState();

      /*
       * Tab khác restore đúng cùng session hiện tại
       * thì không cần reset local state.
       */
      if (
        currentScope?.userId === message.scope.userId &&
        currentScope.sessionId === message.scope.sessionId
      ) {
        return;
      }

      this.scopeState.set(message.scope);

      this.emit({
        kind: 'session-established',

        scope: message.scope,

        reason: 'remote-session-established',

        remote: true,
      });

      return;
    }

    if (message.type === 'session-cleared') {
      this.scopeState.set(null);

      this.emit({
        kind: 'session-cleared',

        scope: null,

        reason: message.reason,

        remote: true,
      });

      return;
    }

    this.scopeState.set(null);

    this.emit({
      kind: 'session-invalidated',

      scope: null,

      reason: message.reason,

      remote: true,
    });
  };
}

function parseBroadcastMessage(value: unknown): AuthLifecycleBroadcastMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value['type'];

  if (type === 'session-established') {
    const scope = value['scope'];

    if (!isRecord(scope)) {
      return null;
    }

    const userId = scope['userId'];

    const sessionId = scope['sessionId'];

    if (typeof userId !== 'string' || typeof sessionId !== 'string') {
      return null;
    }

    return {
      type,

      scope: {
        userId,

        sessionId,
      },
    };
  }

  if (type === 'session-cleared' || type === 'session-invalidated') {
    const reason = value['reason'];

    return {
      type,

      reason: typeof reason === 'string' ? reason : type,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
