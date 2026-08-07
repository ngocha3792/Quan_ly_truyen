import {
    defineConfig,
    devices,
} from '@playwright/test';

const isCi =
    Boolean(
        process.env['CI'],
    );

const isExternalServer =
    process.env[
    'E2E_EXTERNAL'
    ] === 'true';

const baseURL =
    process.env[
    'E2E_BASE_URL'
    ] ??
    'http://127.0.0.1:4200';

export default defineConfig({
    testDir:
        './e2e',

    fullyParallel:
        true,

    forbidOnly:
        isCi,

    retries:
        isCi
            ? 2
            : 0,

    workers:
        isCi
            ? 2
            : undefined,

    timeout:
        30_000,

    expect: {
        timeout:
            8_000,
    },

    outputDir:
        'test-results',

    reporter:
        isCi
            ? [
                [
                    'github',
                ],

                [
                    'html',

                    {
                        outputFolder:
                            'playwright-report',

                        open:
                            'never',
                    },
                ],
            ]
            : [
                [
                    'list',
                ],

                [
                    'html',

                    {
                        outputFolder:
                            'playwright-report',

                        open:
                            'never',
                    },
                ],
            ],

    use: {
        baseURL,

        trace:
            'on-first-retry',

        screenshot:
            'only-on-failure',

        video:
            'retain-on-failure',

        actionTimeout:
            10_000,

        navigationTimeout:
            20_000,
    },

    projects: [
        {
            name:
                'public-chromium',

            testMatch:
                /public\/.*\.spec\.ts/,

            use: {
                ...devices[
                'Desktop Chrome'
                ],

                storageState: {
                    cookies: [],

                    origins: [],
                },
            },
        },

        {
            name:
                'account-chromium',

            testMatch:
                /account\/.*\.spec\.ts/,

            use: {
                ...devices[
                'Desktop Chrome'
                ],

                /**
                 * Không dùng shared storageState.
                 *
                 * authenticated-test.ts sẽ login
                 * riêng cho mỗi test.
                 */
                storageState: {
                    cookies: [],

                    origins: [],
                },
            },
        },
    ],

    webServer:
        isExternalServer
            ? undefined
            : {
                command:
                    'npm start -- --host 127.0.0.1 --port 4200',

                url:
                    baseURL,

                timeout:
                    120_000,

                reuseExistingServer:
                    !isCi,

                stdout:
                    'pipe',

                stderr:
                    'pipe',
            },
});