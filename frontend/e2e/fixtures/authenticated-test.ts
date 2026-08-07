import {
    expect,
    test as base,
} from '@playwright/test';

import {
    E2E_USER_EMAIL,
    E2E_USER_PASSWORD,
} from './e2e-user';

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
                        /**
                         * Đây là fixture infrastructure.
                         *
                         * Không dùng actionTimeout 10s
                         * của browser action.
                         */
                        timeout:
                            30_000,

                        data: {
                            identifier:
                                E2E_USER_EMAIL,

                            password:
                                E2E_USER_PASSWORD,

                            deviceName:
                                `Playwright - ${testInfo.title}`,

                            deviceId:
                                [
                                    'playwright',
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

            if (
                !response.ok()
            ) {
                throw new Error(
                    [
                        'Không thể login E2E user.',
                        '',
                        responseText,
                        '',
                        'Kiểm tra backend và db:seed:e2e.',
                    ].join('\n'),
                );
            }

            /**
             * refresh_token đã nằm trong
             * BrowserContext cookie jar.
             *
             * Hint này khiến AuthStore restore
             * session khi Angular boot.
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
                                timeout:
                                    30_000,

                                headers: {
                                    'x-csrf-token':
                                        csrf.value,
                                },
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