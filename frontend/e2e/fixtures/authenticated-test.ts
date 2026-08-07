import {
    expect,
    test as base,
} from '@playwright/test';

const email =
    process.env[
    'E2E_USER_EMAIL'
    ] ??
    'e2e.user@truyenhub.test';

const password =
    process.env[
    'E2E_USER_PASSWORD'
    ] ??
    'E2eUser@2026';

const baseUrl =
    process.env[
    'E2E_BASE_URL'
    ] ??
    'http://127.0.0.1:4200';

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
            /**
             * Login riêng cho MỖI test.
             *
             * page.request dùng chung cookie jar
             * với BrowserContext.
             */
            const response =
                await page.request.post(
                    '/api/v1/auth/login',

                    {
                        data: {
                            identifier:
                                email,

                            password,

                            deviceName:
                                `Playwright ${testInfo.title}`,

                            deviceId:
                                [
                                    'pw',
                                    testInfo.workerIndex,
                                    Date.now(),
                                    Math.random()
                                        .toString(36)
                                        .slice(2),
                                ].join('-'),
                        },
                    },
                );

            const responseText =
                await response.text();

            expect(
                response.ok(),
                responseText,
            ).toBeTruthy();

            /**
             * Đảm bảo AuthStore thử restore
             * session ngay khi trang load.
             *
             * Refresh cookie HttpOnly đã nằm
             * trong BrowserContext.
             */
            await page.addInitScript(
                ({
                    key,
                }) => {
                    window.localStorage.setItem(
                        key,
                        'true',
                    );
                },

                {
                    key:
                        SESSION_HINT_KEY,
                },
            );

            try {
                await use(page);
            } finally {
                /**
                 * Cleanup session sau mỗi test.
                 *
                 * Nếu test đã logout hoặc revoke
                 * session thì csrf cookie có thể
                 * không còn; khi đó bỏ qua.
                 */
                const cookies =
                    await page
                        .context()
                        .cookies();

                const csrf =
                    cookies.find(
                        (cookie) =>
                            cookie.name ===
                            'csrf_token',
                    );

                if (!csrf) {
                    return;
                }

                await page.request
                    .post(
                        '/api/v1/auth/logout',

                        {
                            headers: {
                                'x-csrf-token':
                                    csrf.value,

                                origin:
                                    new URL(
                                        baseUrl,
                                    ).origin,
                            },
                        },
                    )
                    .catch(
                        () =>
                            undefined,
                    );
            }
        },
    });

export {
    expect,
};