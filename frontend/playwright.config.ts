import {
    defineConfig,
    devices,
} from '@playwright/test';

import path from 'node:path';

const isCi = Boolean(process.env['CI']);

const isExternalServer =
    process.env['E2E_EXTERNAL'] === 'true';

const baseURL =
    process.env['E2E_BASE_URL'] ??
    'http://127.0.0.1:4200';

const authFile = path.join(
    __dirname,
    'playwright/.auth/user.json',
);

export default defineConfig({
    testDir: './e2e',

    fullyParallel: true,

    forbidOnly: isCi,

    retries: isCi ? 2 : 0,

    workers: isCi ? 2 : undefined,

    timeout: 30_000,

    expect: {
        timeout: 8_000,
    },

    outputDir: 'test-results',

    reporter: isCi
        ? [
            ['github'],
            [
                'html',
                {
                    outputFolder: 'playwright-report',
                    open: 'never',
                },
            ],
        ]
        : [
            ['list'],
            [
                'html',
                {
                    outputFolder: 'playwright-report',
                    open: 'never',
                },
            ],
        ],

    use: {
        baseURL,

        trace: 'on-first-retry',

        screenshot: 'only-on-failure',

        video: 'retain-on-failure',

        actionTimeout: 10_000,

        navigationTimeout: 20_000,
    },

    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },

        {
            name: 'public-chromium',

            testMatch:
                /public\/.*\.spec\.ts/,

            use: {
                ...devices['Desktop Chrome'],

                storageState: {
                    cookies: [],
                    origins: [],
                },
            },
        },

        {
            name: 'account-chromium',

            testMatch:
                /account\/.*\.spec\.ts/,

            dependencies: ['setup'],

            use: {
                ...devices['Desktop Chrome'],
                storageState: authFile,
            },
        },
    ],

    webServer: isExternalServer
        ? undefined
        : {
            command:
                'npm start -- --host 127.0.0.1 --port 4200',

            url: baseURL,

            timeout: 120_000,

            reuseExistingServer: !isCi,

            stdout: 'pipe',
            stderr: 'pipe',
        },
});