import { DestroyRef, inject, Injectable, OnDestroy } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  catchError,
  EMPTY,
  exhaustMap,
  filter,
  finalize,
  fromEvent,
  Observable,
  of,
  shareReplay,
  tap,
} from 'rxjs';

import { AuthApiService } from './auth-api.service';

import { CurrentUser } from './auth.models';

import { AuthStore } from './auth.store';

const AUTHORIZATION_CHANNEL_NAME = 'truyenhub.auth.authorization';

interface AuthorizationChangedMessage {
  readonly type: 'authorization-changed';

  readonly userId: string;

  readonly sessionId: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthAuthorizationSyncService implements OnDestroy {
  private readonly api = inject(AuthApiService);

  private readonly auth = inject(AuthStore);

  private readonly destroyRef = inject(DestroyRef);

  private syncInFlight$: Observable<CurrentUser> | null = null;

  private channel: BroadcastChannel | null = null;

  constructor() {
    this.setupBroadcastChannel();

    this.setupWindowFocusSync();
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

  /**
   * Revalidate identity + authorization
   * mà KHÔNG chủ động rotate refresh token.
   *
   * /auth/me vẫn đi qua interceptor.
   *
   * Nếu access token thật sự expired:
   * interceptor sẽ tự refresh như bình thường.
   */
  revalidateCurrentUser(
    options: {
      readonly broadcast?: boolean;
    } = {},
  ): Observable<CurrentUser | null> {
    const current = this.auth.user();

    if (this.auth.status() !== 'authenticated' || !current) {
      return of(null);
    }

    if (this.syncInFlight$) {
      return this.syncInFlight$;
    }

    const before = authorizationFingerprint(current);

    const broadcast = options.broadcast ?? true;

    const sync$ = this.api.me().pipe(
      tap((freshUser) => {
        const after = authorizationFingerprint(freshUser);

        /*
         * AuthStore tiếp tục là canonical
         * CurrentUser state.
         */
        this.auth.replaceCurrentUser(freshUser);

        if (broadcast && before !== after) {
          this.broadcastChange(freshUser);
        }
      }),

      finalize(() => {
        this.syncInFlight$ = null;
      }),

      /*
       * Nhiều guard / component cùng nghi ngờ
       * authorization stale → chỉ GET /auth/me
       * đúng một lần.
       */
      shareReplay({
        bufferSize: 1,

        refCount: false,
      }),
    );

    this.syncInFlight$ = sync$;

    return sync$;
  }

  /**
   * Dùng cho feature vừa nhận được một business
   * signal cho biết role/permission có thể thay đổi.
   *
   * Ví dụ:
   * AuthorApplication chuyển APPROVED.
   */
  notifyAuthorizationMayHaveChanged(): void {
    this.revalidateCurrentUser()
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  private setupWindowFocusSync(): void {
    if (typeof window === 'undefined') {
      return;
    }

    /*
     * Ví dụ:
     *
     * user đang ở tab khác,
     * admin approve application,
     * user quay lại app.
     *
     * Focus sẽ revalidate CurrentUser.
     *
     * Không rotate refresh token trừ khi
     * access token thực sự expired.
     */
    fromEvent(
      window,

      'focus',
    )
      .pipe(
        filter(() => this.auth.status() === 'authenticated' && Boolean(this.auth.user())),

        exhaustMap(() => this.revalidateCurrentUser().pipe(catchError(() => EMPTY))),

        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private setupBroadcastChannel(): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }

    this.channel = new BroadcastChannel(AUTHORIZATION_CHANNEL_NAME);

    this.channel.addEventListener(
      'message',

      this.handleBroadcastMessage,
    );
  }

  private broadcastChange(user: CurrentUser): void {
    const message: AuthorizationChangedMessage = {
      type: 'authorization-changed',

      userId: user.id,

      sessionId: user.sessionId,
    };

    this.channel?.postMessage(message);
  }

  private readonly handleBroadcastMessage = (event: MessageEvent<unknown>): void => {
    const message = parseAuthorizationMessage(event.data);

    if (!message) {
      return;
    }

    const current = this.auth.user();

    /*
     * Event của user/session khác
     * không liên quan tới tab này.
     */
    if (!current || current.id !== message.userId || current.sessionId !== message.sessionId) {
      return;
    }

    this.revalidateCurrentUser({
      /*
       * Tránh:
       *
       * tab A broadcast
       * → tab B sync
       * → tab B broadcast
       * → tab A sync ...
       */
      broadcast: false,
    })
      .pipe(catchError(() => EMPTY))
      .subscribe();
  };
}

function authorizationFingerprint(user: CurrentUser): string {
  const roles = [...user.roles].map(normalizeRole).sort();

  const permissions = [...user.permissions].map(normalizePermission).sort();

  return JSON.stringify({
    userId: user.id,

    sessionId: user.sessionId,

    roles,

    permissions,

    authorProfileId: user.authorProfile?.id ?? null,

    authorVerificationStatus: user.authorProfile?.verificationStatus ?? null,
  });
}

function normalizeRole(role: string): string {
  return role.trim().toUpperCase();
}

function normalizePermission(permission: string): string {
  return permission.trim().toLowerCase();
}

function parseAuthorizationMessage(value: unknown): AuthorizationChangedMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    record['type'] !== 'authorization-changed' ||
    typeof record['userId'] !== 'string' ||
    typeof record['sessionId'] !== 'string'
  ) {
    return null;
  }

  return {
    type: 'authorization-changed',

    userId: record['userId'],

    sessionId: record['sessionId'],
  };
}
