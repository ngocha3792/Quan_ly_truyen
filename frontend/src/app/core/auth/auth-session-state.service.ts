import { computed, inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthSessionLifecycleService } from './auth-session-lifecycle.service';

import type { AuthSessionLifecycleEvent } from './auth-session-lifecycle.service';

import { AuthSessionHintStore } from './auth-session-hint.store';

import type { CurrentUser } from './auth.models';

import type { AuthStatus } from './auth.store.types';

import { TokenStore } from './token.store';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionStateService {
  private readonly tokens = inject(TokenStore);

  private readonly sessionHint = inject(AuthSessionHintStore);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly userState = signal<CurrentUser | null>(null);

  private readonly statusState = signal<AuthStatus>('idle');

  private bootstrapped = false;

  readonly user = this.userState.asReadonly();

  readonly status = this.statusState.asReadonly();

  readonly isAuthenticated = computed(
    () => this.statusState() === 'authenticated' && Boolean(this.userState()),
  );

  constructor() {
    this.lifecycle.changes$
      .pipe(takeUntilDestroyed())
      .subscribe((event: AuthSessionLifecycleEvent) => {
        this.handleLifecycleEvent(event);
      });
  }

  isBootstrapped(): boolean {
    return this.bootstrapped;
  }

  setLoading(): void {
    this.statusState.set('loading');
  }

  /**
   * Chỉ đổi status.
   *
   * Không clear token/hint ở đây vì register()
   * trước đây cũng chỉ chuyển trạng thái loading
   * về anonymous nếu chưa có user.
   */
  setAnonymousStatus(): void {
    this.statusState.set('anonymous');
  }

  setAuthenticated(user: CurrentUser): void {
    this.sessionHint.markSessionPresent();

    this.userState.set(user);

    this.statusState.set('authenticated');

    this.bootstrapped = true;

    /*
     * session scope = user + session.
     *
     * Nếu tab khác login account/session khác
     * thì lifecycle có thể invalidate state
     * của tab hiện tại.
     */
    this.lifecycle.establishSession(user.id, user.sessionId, true);
  }

  applyAnonymousState(): void {
    /*
     * Session chắc chắn không còn hợp lệ.
     */
    this.tokens.clear();

    this.sessionHint.markSessionAbsent();

    this.userState.set(null);

    this.statusState.set('anonymous');

    this.bootstrapped = true;
  }

  applyRecoverableIdleState(): void {
    /*
     * Access token hiện tại không còn được tin cậy.
     */
    this.tokens.clear();

    /*
     * Không được giữ identity cũ trên UI
     * khi chưa xác minh lại được phiên.
     */
    this.userState.set(null);

    /*
     * Network error / 5xx không chứng minh
     * refresh cookie đã chết.
     *
     * Giữ session hint để lần sau còn bootstrap.
     */
    this.sessionHint.markSessionPresent();

    this.statusState.set('idle');

    this.bootstrapped = false;
  }

  private handleLifecycleEvent(event: AuthSessionLifecycleEvent): void {
    /*
     * Logout hoặc refresh session bị reject.
     */
    if (event.kind === 'session-invalidated' || event.kind === 'session-cleared') {
      this.applyAnonymousState();

      return;
    }

    /*
     * Mất access token nhưng refresh session
     * chưa chắc đã chết.
     */
    if (event.kind === 'access-lost') {
      this.applyRecoverableIdleState();

      return;
    }

    /*
     * Tab khác thiết lập session mới.
     *
     * Ví dụ:
     *
     * Tab A = Alice
     * Tab B login = Bob
     *
     * Refresh cookie giờ thuộc Bob,
     * Tab A không được tiếp tục giữ Alice.
     */
    if (event.kind === 'session-established' && event.remote) {
      this.applyRecoverableIdleState();
    }
  }
}
