import { computed, inject, Injectable, signal } from '@angular/core';

import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';

import {
  AccountSecurityEventsResponse,
  AccountSecuritySummary,
  AccountSessionsResponse,
} from './account-api.models';

import { AccountApiService } from './account-api.service';

const EMPTY_SESSIONS: AccountSessionsResponse = {
  sessions: [],
  total: 0,
};

const EMPTY_SECURITY_EVENTS: AccountSecurityEventsResponse = {
  events: [],
  total: 0,
};

@Injectable({
  providedIn: 'root',
})
export class AccountStore {
  private readonly api = inject(AccountApiService);

  private readonly auth = inject(AuthStore);

  private readonly sessionsState = signal<AccountSessionsResponse>(EMPTY_SESSIONS);

  private readonly securityEventsState =
    signal<AccountSecurityEventsResponse>(EMPTY_SECURITY_EVENTS);

  private readonly loadingState = signal(false);

  private readonly errorState = signal<string | null>(null);

  private loaded = false;

  readonly user = this.auth.user;

  readonly sessions = this.sessionsState.asReadonly();

  readonly securityEvents = this.securityEventsState.asReadonly();

  readonly loading = this.loadingState.asReadonly();

  readonly error = this.errorState.asReadonly();

  readonly activeSessionCount = computed(() => this.sessionsState().total);

  readonly activityCount = computed(() => this.securityEventsState().total);

  readonly joinedDays = computed(() => {
    const createdAt = this.user()?.createdAt;

    if (!createdAt) {
      return 1;
    }

    const createdTimestamp = new Date(createdAt).getTime();

    if (Number.isNaN(createdTimestamp)) {
      return 1;
    }

    const difference = Date.now() - createdTimestamp;

    return Math.max(1, Math.ceil(difference / 86_400_000));
  });

  readonly membershipLabel = computed(() => {
    const roles = this.user()?.roles.map((role) => role.toLowerCase()) ?? [];

    if (roles.includes('admin')) {
      return 'Quản trị viên';
    }

    if (roles.includes('author')) {
      return 'Tác giả';
    }

    return 'Thành viên';
  });

  readonly securitySummary = computed<AccountSecuritySummary>(() => {
    const user = this.user();
    const sessions = this.sessionsState();

    let score = 35;

    if (user?.emailVerified) {
      score += 35;
    }

    if (sessions.sessions.some((session) => session.isCurrent)) {
      score += 20;
    }

    if (sessions.total <= 3) {
      score += 10;
    }

    score = Math.min(score, 100);

    if (score >= 80) {
      return {
        score,
        label: 'Cao',
        tone: 'high',
        description: 'Tài khoản của bạn đang được bảo vệ tốt.',
      };
    }

    if (score >= 55) {
      return {
        score,
        label: 'Trung bình',
        tone: 'medium',
        description: 'Bạn nên bổ sung thêm các lớp bảo mật.',
      };
    }

    return {
      score,
      label: 'Thấp',
      tone: 'low',
      description: 'Tài khoản cần được kiểm tra bảo mật.',
    };
  });

  load(force = false): void {
    if (this.loadingState() || (this.loaded && !force)) {
      return;
    }

    this.loadingState.set(true);
    this.errorState.set(null);

    const sessionsRequest = this.api.getSessions().pipe(
      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return of(EMPTY_SESSIONS);
      }),
    );

    const securityEventsRequest = this.api.getSecurityEvents(5).pipe(
      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return of(EMPTY_SECURITY_EVENTS);
      }),
    );

    forkJoin({
      sessions: sessionsRequest,
      securityEvents: securityEventsRequest,
    })
      .pipe(
        finalize(() => {
          this.loadingState.set(false);
        }),
      )
      .subscribe(({ sessions, securityEvents }) => {
        this.sessionsState.set(sessions);

        this.securityEventsState.set(securityEvents);

        this.loaded = true;
      });
  }

  reload(): void {
    this.load(true);
  }

  clearError(): void {
    this.errorState.set(null);
  }
}
