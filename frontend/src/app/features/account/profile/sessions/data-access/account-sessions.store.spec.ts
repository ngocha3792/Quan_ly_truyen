import { TestBed } from '@angular/core/testing';

import { firstValueFrom, of } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionLifecycleService } from '../../../../../core/auth/auth-session-lifecycle.service';

import { AccountSessionsApiService } from './account-sessions-api.service';

import { AccountSessionsStore } from './account-sessions.store';

describe('AccountSessionsStore', () => {
  let store: AccountSessionsStore;

  let lifecycle: AuthSessionLifecycleService;

  let api: {
    getSessions: ReturnType<typeof vi.fn>;

    getRecentSecurityEvents: ReturnType<typeof vi.fn>;

    revokeSession: ReturnType<typeof vi.fn>;

    revokeOtherSessions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      getSessions: vi.fn(),

      getRecentSecurityEvents: vi.fn(),

      revokeSession: vi.fn(),

      revokeOtherSessions: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AccountSessionsStore,

        AuthSessionLifecycleService,

        {
          provide: AccountSessionsApiService,

          useValue: api,
        },
      ],
    });

    lifecycle = TestBed.inject(AuthSessionLifecycleService);

    store = TestBed.inject(AccountSessionsStore);

    lifecycle.establishSession(
      'user-1',

      'session-current',

      false,
    );
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('revoke all others phải gọi đúng một bulk API rồi reload server state', async () => {
    api.getSessions
      .mockReturnValueOnce(
        of({
          total: 3,

          sessions: [
            session(
              'session-current',

              true,
            ),

            session(
              'session-2',

              false,
            ),

            session(
              'session-3',

              false,
            ),
          ],
        }),
      )
      .mockReturnValueOnce(
        of({
          total: 1,

          sessions: [
            session(
              'session-current',

              true,
            ),
          ],
        }),
      );

    api.getRecentSecurityEvents.mockReturnValue(
      of({
        events: [],

        total: 0,
      }),
    );

    api.revokeOtherSessions.mockReturnValue(
      of({
        revokedCount: 2,
      }),
    );

    store.load();

    expect(store.sessions()).toHaveLength(3);

    await firstValueFrom(store.revokeAllOtherSessions());

    expect(api.revokeOtherSessions).toHaveBeenCalledTimes(1);

    /*
     * Flow cũ gọi N DELETE.
     *
     * Sau Phase 1 tuyệt đối không được
     * quay lại behavior đó.
     */
    expect(api.revokeSession).not.toHaveBeenCalled();

    expect(api.getSessions).toHaveBeenCalledTimes(2);

    expect(store.sessions()).toHaveLength(1);

    expect(store.sessions()[0]?.isCurrent).toBe(true);

    expect(store.success()).toContain('2');
  });
});

function session(
  id: string,

  isCurrent: boolean,
) {
  return {
    id,

    isCurrent,

    deviceId: id,

    deviceName: isCurrent ? 'Current device' : 'Other device',

    ipAddress: '127.0.0.1',

    userAgent: 'Mozilla/5.0 Chrome/120',

    lastUsedAt: '2026-08-08T12:00:00.000Z',

    createdAt: '2026-08-08T11:00:00.000Z',

    expiresAt: '2026-09-08T11:00:00.000Z',
  };
}
