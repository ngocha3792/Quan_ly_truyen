import { defineConfig, devices } from '@playwright/test';

const isCi = Boolean(process.env['CI']);

const isExternalServer = process.env['E2E_EXTERNAL'] === 'true';

const baseURL = isExternalServer
  ? (process.env['E2E_BASE_URL'] ?? 'http://localhost:4200')
  : 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',

  /**
   * Auth E2E hiện dùng chung một account:
   *
   * e2e.user@truyenhub.test
   *
   * Backend cố ý serialize concurrent login
   * cùng user bằng PostgreSQL row lock.
   *
   * Vì vậy không chạy các Auth E2E song song.
   */
  fullyParallel: false,

  workers: 1,

  forbidOnly: isCi,

  retries: isCi ? 1 : 0,

  timeout: 30_000,

  expect: {
    timeout: 10_000,
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
      name: 'public-chromium',

      testMatch: 'public/**/*.spec.ts',

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

      testMatch: 'account/**/*.spec.ts',

      use: {
        ...devices['Desktop Chrome'],

        storageState: {
          cookies: [],

          origins: [],
        },
      },
    },

    {
      name: 'admin-chromium',

      testMatch: 'admin/**/*.spec.ts',

      use: {
        ...devices['Desktop Chrome'],

        storageState: {
          cookies: [],

          origins: [],
        },
      },
    },
  ],

  webServer: isExternalServer
    ? undefined
    : {
        command: 'npm start -- --host localhost --port 4200',

        url: 'http://localhost:4200',

        timeout: 120_000,

        reuseExistingServer: !isCi,

        stdout: 'pipe',

        stderr: 'pipe',
      },
});
