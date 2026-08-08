import { TestBed } from '@angular/core/testing';

import { of, Subject } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthAuthorizationSyncService } from '../../../../core/auth/auth-authorization-sync.service';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationRecord,
} from '../domain/author-application.models';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

import { AuthorApplicationStore } from './author-application.store';

describe('AuthorApplicationStore session lifecycle regression', () => {
  let store: AuthorApplicationStore;

  let lifecycle: AuthSessionLifecycleService;

  let repository: {
    getConfig: ReturnType<typeof vi.fn>;

    getMine: ReturnType<typeof vi.fn>;

    saveDraft: ReturnType<typeof vi.fn>;

    submit: ReturnType<typeof vi.fn>;
  };

  let authorizationSync: {
    notifyAuthorizationMayHaveChanged: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repository = {
      getConfig: vi.fn(),

      getMine: vi.fn(),

      saveDraft: vi.fn(),

      submit: vi.fn(),
    };

    authorizationSync = {
      notifyAuthorizationMayHaveChanged: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthorApplicationStore,

        AuthSessionLifecycleService,

        {
          provide: AuthorApplicationRepository,

          useValue: repository,
        },

        {
          provide: AuthAuthorizationSyncService,

          useValue: authorizationSync,
        },
      ],
    });

    lifecycle = TestBed.inject(AuthSessionLifecycleService);

    store = TestBed.inject(AuthorApplicationStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('phải xóa application state của Alice khi session chuyển sang Bob', () => {
    const aliceApplication = createApplication({
      userId: 'alice-user',

      applicationId: 'alice-application',

      penName: 'Alice Pen Name',
    });

    repository.getConfig.mockReturnValue(of(AUTHOR_APPLICATION_CONFIG));

    repository.getMine.mockReturnValue(of(aliceApplication));

    /*
     * Tab hiện tại bắt đầu dưới session Alice.
     */
    lifecycle.establishSession(
      'alice-user',

      'alice-session',

      false,
    );

    store.load();

    expect(store.application()?.userId).toBe('alice-user');

    expect(store.application()?.penName).toBe('Alice Pen Name');

    /*
     * Ví dụ tab khác login Bob.
     *
     * Feature store hiện tại vẫn mounted.
     */
    lifecycle.establishSession(
      'bob-user',

      'bob-session',

      false,
    );

    /*
     * Invariant:
     *
     * user-scoped data của Alice không được tồn tại
     * sau khi auth scope đã chuyển sang Bob.
     */
    expect(store.application()).toBeNull();

    expect(store.message()).toBe('');

    expect(store.errorMessage()).toBe('');
  });

  it('response saveDraft của Alice về muộn không được ghi vào state sau khi session đã chuyển sang Bob', () => {
    const saveResult$ = new Subject<AuthorApplicationRecord>();

    repository.saveDraft.mockReturnValue(saveResult$.asObservable());

    lifecycle.establishSession(
      'alice-user',

      'alice-session',

      false,
    );

    store.saveDraft(
      createDraft({
        penName: 'Alice Pen Name',
      }),
    );

    expect(store.status()).toBe('saving-draft');

    /*
     * Request saveDraft của Alice vẫn đang pending.
     *
     * Trong lúc đó auth session chuyển sang Bob.
     */
    lifecycle.establishSession(
      'bob-user',

      'bob-session',

      false,
    );

    /*
     * Response cũ của Alice đến sau session switch.
     */
    saveResult$.next(
      createApplication({
        userId: 'alice-user',

        applicationId: 'alice-application',

        penName: 'Alice Pen Name',
      }),
    );

    saveResult$.complete();

    /*
     * Response stale tuyệt đối không được mutate
     * current feature state của Bob.
     */
    expect(store.application()).toBeNull();

    expect(store.message()).toBe('');

    expect(store.errorMessage()).toBe('');
  });

  it('response load của Alice về muộn không được ghi vào state sau khi session chuyển sang Bob', () => {
    const configResult$ = new Subject<AuthorApplicationConfig>();

    const applicationResult$ = new Subject<AuthorApplicationRecord | null>();

    repository.getConfig.mockReturnValue(configResult$.asObservable());

    repository.getMine.mockReturnValue(applicationResult$.asObservable());

    lifecycle.establishSession('alice-user', 'alice-session', false);

    store.load();

    expect(store.status()).toBe('loading');

    lifecycle.establishSession('bob-user', 'bob-session', false);

    /**
     * Lifecycle event phải reset local state ngay.
     */
    expect(store.application()).toBeNull();

    expect(store.status()).toBe('idle');

    /**
     * Giả lập response cũ của Alice về sau.
     *
     * Subscription phải đã bị takeUntil()
     * hủy nên các next này không được mutate store.
     */
    configResult$.next(AUTHOR_APPLICATION_CONFIG);

    configResult$.complete();

    applicationResult$.next(
      createApplication({
        userId: 'alice-user',

        applicationId: 'alice-application',

        penName: 'Alice Pen Name',
      }),
    );

    applicationResult$.complete();

    expect(store.application()).toBeNull();

    expect(store.status()).toBe('idle');

    expect(store.message()).toBe('');

    expect(store.errorMessage()).toBe('');
  });

  it('response submit của Alice về muộn không được ghi vào state sau khi session chuyển sang Bob', () => {
    const submitResult$ = new Subject<AuthorApplicationRecord>();

    repository.submit.mockReturnValue(submitResult$.asObservable());

    lifecycle.establishSession('alice-user', 'alice-session', false);

    store.submit(
      createPayload({
        penName: 'Alice Pen Name',
      }),
    );

    expect(store.status()).toBe('submitting');

    lifecycle.establishSession('bob-user', 'bob-session', false);

    expect(store.application()).toBeNull();

    expect(store.status()).toBe('idle');

    submitResult$.next(
      createApplication({
        userId: 'alice-user',

        applicationId: 'alice-application',

        penName: 'Alice Pen Name',

        status: 'PENDING',
      }),
    );

    submitResult$.complete();

    /**
     * Alice response không được xuất hiện
     * trong Bob session.
     */
    expect(store.application()).toBeNull();

    expect(store.status()).toBe('idle');

    expect(store.message()).toBe('');

    expect(store.errorMessage()).toBe('');
  });
});

const AUTHOR_APPLICATION_CONFIG: AuthorApplicationConfig = {
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

function createDraft(overrides: Partial<AuthorApplicationDraft> = {}): AuthorApplicationDraft {
  return {
    penName: 'Phase 0 Author',

    fullName: 'Phase 0 Test User',

    email: 'phase0@example.test',

    phone: '0900000000',

    portfolioUrl: 'https://example.test/portfolio',

    primaryGenre: 'Fantasy',

    experience: '1-3-years',

    introduction: 'Regression test introduction.',

    firstWorkSynopsis: 'Regression test synopsis.',

    acceptedTerms: true,

    sampleFileName: 'sample.pdf',

    ...overrides,
  };
}

function createPayload(
  overrides: Partial<AuthorApplicationPayload> = {},
): AuthorApplicationPayload {
  return {
    ...createDraft(),

    sampleFile: new File(['phase-5-regression-sample'], 'sample.pdf', {
      type: 'application/pdf',
    }),

    ...overrides,
  };
}

function createApplication(
  overrides: Partial<AuthorApplicationRecord> = {},
): AuthorApplicationRecord {
  return {
    ...createDraft(),

    applicationId: 'phase0-application',

    userId: 'phase0-user',

    status: 'DRAFT',

    sample: null,

    submittedAt: null,

    reviewedAt: null,

    reviewedById: null,

    rejectionReason: null,

    createdAt: '2026-08-08T00:00:00.000Z',

    updatedAt: '2026-08-08T00:00:00.000Z',

    ...overrides,
  };
}
