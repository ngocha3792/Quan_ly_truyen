import {
  TestBed,
} from '@angular/core/testing';

import {
  of,
  Subject,
  throwError,
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
} from '../../../../../core/auth/auth-session-lifecycle.service';

import {
  AccountProfileApiService,
} from './account-profile-api.service';

import {
  AccountPreferencesStore,
} from './account-preferences.store';

describe(
  'AccountPreferencesStore',

  () => {
    let store:
      AccountPreferencesStore;

    let lifecycle:
      AuthSessionLifecycleService;

    let api: {
      getPreferences:
        ReturnType<
          typeof vi.fn
        >;

      updatePreferences:
        ReturnType<
          typeof vi.fn
        >;
    };

    beforeEach(() => {
      api = {
        getPreferences:
          vi.fn(),

        updatePreferences:
          vi.fn(),
      };

      TestBed.configureTestingModule({
        providers: [
          AccountPreferencesStore,

          AuthSessionLifecycleService,

          {
            provide:
              AccountProfileApiService,

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
          AccountPreferencesStore,
        );

      lifecycle.establishSession(
        'alice',

        'alice-session',

        false,
      );
    });

    afterEach(() => {
      TestBed.resetTestingModule();
    });

    it(
      'serialize các update bằng concatMap',

      () => {
        const first$ =
          new Subject<{
            newChapterNotifications:
              boolean;

            showRecentActivity:
              boolean;

            allowUpdateEmails:
              boolean;
          }>();

        api.updatePreferences
          .mockReturnValueOnce(
            first$.asObservable(),
          )
          .mockReturnValueOnce(
            of({
              newChapterNotifications:
                false,

              showRecentActivity:
                false,

              allowUpdateEmails:
                true,
            }),
          );

        store.update({
          newChapterNotifications:
            false,
        });

        store.update({
          showRecentActivity:
            false,
        });

        /*
         * Request 2 chưa được chạy
         * vì request 1 chưa complete.
         */
        expect(
          api.updatePreferences,
        ).toHaveBeenCalledTimes(
          1,
        );

        first$.next({
          newChapterNotifications:
            false,

          showRecentActivity:
            true,

          allowUpdateEmails:
            true,
        });

        first$.complete();

        expect(
          api.updatePreferences,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          api.updatePreferences.mock.calls[1]?.[0],
        ).toEqual({
          newChapterNotifications:
            false,

          showRecentActivity:
            false,

          allowUpdateEmails:
            true,
        });

        expect(
          store.preferences(),
        ).toEqual({
          newChapterNotifications:
            false,

          showRecentActivity:
            false,

          allowUpdateEmails:
            true,
        });
      },
    );

    it(
      'request lỗi phải reload authoritative server state',

      () => {
        api.updatePreferences.mockReturnValue(
          throwError(
            () =>
              new Error(
                'save failed',
              ),
          ),
        );

        api.getPreferences.mockReturnValue(
          of({
            newChapterNotifications:
              true,

            showRecentActivity:
              false,

            allowUpdateEmails:
              true,
          }),
        );

        store.update({
          newChapterNotifications:
            false,
        });

        expect(
          api.getPreferences,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          store.preferences(),
        ).toEqual({
          newChapterNotifications:
            true,

          showRecentActivity:
            false,

          allowUpdateEmails:
            true,
        });

        expect(
          store.error(),
        ).toBe(
          'save failed',
        );
      },
    );
  },
);
