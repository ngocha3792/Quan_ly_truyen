import { signal } from '@angular/core';

import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionLifecycleService } from '../../../../../core/auth/auth-session-lifecycle.service';

import { AuthStore } from '../../../../../core/auth/auth.store';

import { createCurrentUser } from '../../../../../core/auth/testing/auth-test.fixtures';

import { AccountSecurityApiService } from './account-security-api.service';

import { AccountSecurityStore } from './account-security.store';

describe('AccountSecurityStore security score', () => {
  let store: AccountSecurityStore;

  let api: {
    getOverview: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const userState = signal(
      createCurrentUser({
        /*
         * Primary email verified.
         *
         * Nhưng recovery email vẫn
         * chưa configured.
         */
        emailVerified: true,
      }),
    );

    api = {
      getOverview: vi.fn(),
    };

    const auth = {
      user: userState.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        AccountSecurityStore,

        AuthSessionLifecycleService,

        {
          provide: AccountSecurityApiService,

          useValue: api,
        },

        {
          provide: AuthStore,

          useValue: auth,
        },
      ],
    });

    store = TestBed.inject(AccountSecurityStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('primary email verified không được tính recovery-email là hoàn thành', () => {
    api.getOverview.mockReturnValue(
      of({
        passwordConfigured: true,

        passwordUpdatedAt: null,

        mfaEnabled: false,

        mfaConfiguredAt: null,

        recoveryEmail: null,

        recoveryEmailVerified: false,

        securityQuestionsConfigured: false,

        trustedDeviceCount: 0,
      }),
    );

    store.load();

    const recoveryItem = store.securityScore().items.find((item) => item.id === 'recovery-email');

    expect(recoveryItem?.completed).toBe(false);

    /*
     * Chỉ password = 25%.
     *
     * Nếu bug cũ quay lại sẽ thành 50%.
     */
    expect(store.securityScore().percent).toBe(25);
  });
});
