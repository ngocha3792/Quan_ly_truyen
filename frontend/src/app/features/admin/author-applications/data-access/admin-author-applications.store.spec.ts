import {
  TestBed,
} from '@angular/core/testing';

import {
  firstValueFrom,
  of,
  Subject,
} from 'rxjs';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AuthSessionLifecycleService,
} from '../../../../core/auth/auth-session-lifecycle.service';

import {
  AdminAuthorApplicationsApiService,
} from './admin-author-applications-api.service';

import {
  AdminAuthorApplicationsStore,
} from './admin-author-applications.store';

describe(
  'AdminAuthorApplicationsStore',

  () => {
    let store:
      AdminAuthorApplicationsStore;

    let lifecycle:
      AuthSessionLifecycleService;

    let api: {
      list:
        ReturnType<
          typeof vi.fn
        >;

      getOne:
        ReturnType<
          typeof vi.fn
        >;

      approve:
        ReturnType<
          typeof vi.fn
        >;

      reject:
        ReturnType<
          typeof vi.fn
        >;
    };

    beforeEach(() => {
      api = {
        list:
          vi.fn(),

        getOne:
          vi.fn(),

        approve:
          vi.fn(),

        reject:
          vi.fn(),
      };

      TestBed.configureTestingModule({
        providers: [
          AdminAuthorApplicationsStore,

          AuthSessionLifecycleService,

          {
            provide:
              AdminAuthorApplicationsApiService,

            useValue:
              api,
          },
        ],
      });

      lifecycle =
        TestBed.inject(
          AuthSessionLifecycleService,
        );

      store =
        TestBed.inject(
          AdminAuthorApplicationsStore,
        );

      lifecycle.establishSession(
        'reviewer-a',

        'session-a',

        false,
      );
    });

    afterEach(() => {
      TestBed.resetTestingModule();
    });

    it(
      'approve phải thay detail từ PENDING sang APPROVED',

      async () => {
        api.getOne.mockReturnValue(
          of(
            application(
              'PENDING',
            ),
          ),
        );

        store.loadDetail(
          'application-1',
        );

        api.approve.mockReturnValue(
          of(
            application(
              'APPROVED',
            ),
          ),
        );

        await firstValueFrom(
          store.approve(),
        );

        expect(
          api.approve,
        ).toHaveBeenCalledWith(
          'application-1',
        );

        expect(
          store.detail()
            ?.status,
        ).toBe(
          'APPROVED',
        );

        expect(
          store.actionMessage(),
        ).toContain(
          'được duyệt',
        );
      },
    );

    it(
      'detail response của reviewer cũ không được chảy sang session mới',

      () => {
        const result$ =
          new Subject<
            ReturnType<
              typeof application
            >
          >();

        api.getOne.mockReturnValue(
          result$.asObservable(),
        );

        store.loadDetail(
          'application-1',
        );

        lifecycle.establishSession(
          'reviewer-b',

          'session-b',

          false,
        );

        result$.next(
          application(
            'PENDING',
          ),
        );

        result$.complete();

        expect(
          store.detail(),
        ).toBeNull();
      },
    );
  },
);

function application(
  status:
    'PENDING' |
    'APPROVED' |
    'REJECTED',
) {
  return {
    applicationId:
      'application-1',

    userId:
      'applicant-1',

    status,

    penName:
      'Store Pen',

    fullName:
      'Store Applicant',

    email:
      'store@example.test',

    phone:
      '0900000000',

    portfolioUrl:
      null,

    primaryGenre:
      'Fantasy',

    experience:
      '1-3-years',

    introduction:
      'Introduction',

    firstWorkSynopsis:
      'Synopsis',

    acceptedTerms:
      true,

    sample:
      null,

    submittedAt:
      '2026-08-08T12:00:00.000Z',

    reviewedAt:
      status ===
      'PENDING'
        ? null
        : '2026-08-08T13:00:00.000Z',

    reviewedById:
      status ===
      'PENDING'
        ? null
        : 'reviewer-a',

    rejectionReason:
      status ===
      'REJECTED'
        ? 'Rejected reason'
        : null,

    createdAt:
      '2026-08-08T11:00:00.000Z',

    updatedAt:
      '2026-08-08T13:00:00.000Z',
  } as const;
}
