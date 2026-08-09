import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthAuthorizationSyncService } from '../../../../core/auth/auth-authorization-sync.service';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';

import {
  AuthorApplicationConfig,
  AuthorApplicationRecord,
} from '../domain/author-application.models';

import { AuthorApplicationState } from './author-application.state';

describe('AuthorApplicationState', () => {
  let state: AuthorApplicationState;

  let lifecycle: AuthSessionLifecycleService;

  let authorizationSync: {
    notifyAuthorizationMayHaveChanged: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authorizationSync = {
      notifyAuthorizationMayHaveChanged: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthorApplicationState,

        AuthSessionLifecycleService,

        {
          provide: AuthAuthorizationSyncService,

          useValue: authorizationSync,
        },
      ],
    });

    lifecycle = TestBed.inject(AuthSessionLifecycleService);

    state = TestBed.inject(AuthorApplicationState);

    lifecycle.establishSession(
      'user-a',

      'session-a',

      false,
    );
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('giữ config nhưng xóa user-scoped state khi session thay đổi', () => {
    state.setLoaded(
      CONFIG,

      application({
        status: 'DRAFT',
      }),
    );

    state.setMessage('Bản nháp đã được lưu.');

    state.setCheckingStatus(true);

    expect(state.config()).toEqual(CONFIG);

    expect(state.application()).not.toBeNull();

    expect(state.message()).not.toBe('');

    lifecycle.establishSession(
      'user-b',

      'session-b',

      false,
    );

    /*
     * Catalog/policy chung vẫn được cache.
     */
    expect(state.config()).toEqual(CONFIG);

    /*
     * Dữ liệu user cũ phải mất ngay.
     */
    expect(state.application()).toBeNull();

    expect(state.status()).toBe('idle');

    expect(state.message()).toBe('');

    expect(state.errorMessage()).toBe('');

    expect(state.checkingStatus()).toBe(false);
  });

  it('APPROVED chỉ trigger authorization sync một lần trong cùng session', () => {
    const approved = application({
      status: 'APPROVED',
    });

    state.setApplication(approved);

    state.setApplication(approved);

    expect(authorizationSync.notifyAuthorizationMayHaveChanged).toHaveBeenCalledTimes(1);
  });

  it('session mới được phép authorization sync lại', () => {
    state.setApplication(
      application({
        status: 'APPROVED',
      }),
    );

    expect(authorizationSync.notifyAuthorizationMayHaveChanged).toHaveBeenCalledTimes(1);

    lifecycle.establishSession(
      'user-b',

      'session-b',

      false,
    );

    state.setApplication(
      application({
        userId: 'user-b',

        applicationId: 'application-b',

        status: 'APPROVED',
      }),
    );

    expect(authorizationSync.notifyAuthorizationMayHaveChanged).toHaveBeenCalledTimes(2);
  });

  it('clearMessages đưa success/error về idle', () => {
    state.setSuccess('Đã gửi hồ sơ.');

    expect(state.status()).toBe('success');

    state.clearMessages();

    expect(state.status()).toBe('idle');

    expect(state.message()).toBe('');

    expect(state.errorMessage()).toBe('');
  });

  it('passive error không phá operation status hiện tại', () => {
    state.begin('loading');

    state.setPassiveError('Không thể kiểm tra trạng thái.');

    expect(state.status()).toBe('loading');

    expect(state.errorMessage()).toBe('Không thể kiểm tra trạng thái.');
  });
});

const CONFIG: AuthorApplicationConfig = {
  genreOptions: [
    {
      value: 'Fantasy',

      label: 'Fantasy',
    },
  ],

  experienceOptions: [
    {
      value: '1-3-years',

      label: '1 - 3 năm',
    },
  ],

  requirements: [],

  reviewSteps: [],

  benefits: [],

  acceptedFileExtensions: ['.pdf'],

  maximumFileSizeMb: 10,

  introductionMaximumLength: 2_000,

  synopsisMaximumLength: 5_000,
};

function application(overrides: Partial<AuthorApplicationRecord> = {}): AuthorApplicationRecord {
  return {
    applicationId: 'application-a',

    userId: 'user-a',

    status: 'DRAFT',

    penName: 'Phase 7 Author',

    fullName: 'Phase 7 User',

    email: 'phase7@example.test',

    phone: '0900000000',

    portfolioUrl: 'https://example.test',

    primaryGenre: 'Fantasy',

    experience: '1-3-years',

    introduction: 'Introduction',

    firstWorkSynopsis: 'Synopsis',

    acceptedTerms: true,

    sampleFileName: 'sample.pdf',

    sample: null,

    submittedAt: null,

    reviewedAt: null,

    reviewedById: null,

    rejectionReason: null,

    createdAt: '2026-08-09T00:00:00.000Z',

    updatedAt: '2026-08-09T00:00:00.000Z',

    ...overrides,
  };
}
