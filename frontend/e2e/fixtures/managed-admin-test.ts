import {
  expect,
  test as base,
} from '@playwright/test';

import {
  E2E_MANAGER_EMAIL,
  E2E_MANAGER_PASSWORD,
} from './e2e-manager';

const SESSION_HINT_KEY =
  'truyenhub.auth.has-refresh-session';

export const test =
  base.extend({
    page: async (
      {
        page,
      },

      use,

      testInfo,
    ) => {
      const response =
        await page.request.post(
          '/api/v1/auth/login',

          {
            timeout:
              30_000,

            data: {
              identifier:
                E2E_MANAGER_EMAIL,

              password:
                E2E_MANAGER_PASSWORD,

              deviceName:
                `Playwright Manager - ${testInfo.title}`,

              deviceId: [
                'playwright-manager',

                testInfo.workerIndex,

                Date.now(),

                Math.random()
                  .toString(
                    36,
                  )
                  .slice(
                    2,
                  ),
              ].join(
                '-',
              ),
            },
          },
        );

      const responseText =
        await response.text();

      if (
        !response.ok()
      ) {
        throw new Error(
          [
            'Không thể login E2E manager.',

            responseText,

            'Chạy npm run e2e:prepare trước.',
          ].join(
            '\n',
          ),
        );
      }

      await page.addInitScript(
        (
          key,
        ) => {
          window.localStorage.setItem(
            key,

            'true',
          );
        },

        SESSION_HINT_KEY,
      );

      try {
        await use(
          page,
        );
      } finally {
        const cookies =
          await page
            .context()
            .cookies();

        const csrf =
          cookies.find(
            (
              cookie,
            ) =>
              cookie.name ===
              'csrf_token',
          );

        if (csrf) {
          await page.request
            .post(
              '/api/v1/auth/logout',

              {
                headers: {
                  'x-csrf-token':
                    csrf.value,
                },

                timeout:
                  30_000,
              },
            )
            .catch(
              () =>
                undefined,
            );
        }
      }
    },
  });

export {
  expect,
};
