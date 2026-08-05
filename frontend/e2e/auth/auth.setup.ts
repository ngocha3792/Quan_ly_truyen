import {
    expect,
    test as setup,
} from '@playwright/test';

import path from 'node:path';

const authFile = path.join(
    __dirname,
    '../../playwright/.auth/user.json',
);

const email =
    process.env['E2E_USER_EMAIL'] ??
    'e2e.user@truyenhub.test';

const password =
    process.env['E2E_USER_PASSWORD'] ??
    'E2eUser@2026';

setup(
    'authenticate E2E user',
    async ({ request }) => {
        const response = await request.post(
            '/api/v1/auth/login',
            {
                data: {
                    identifier: email,
                    password,
                    deviceName:
                        'Playwright CI Browser',
                },
            },
        );

        expect(
            response.ok(),
            await response.text(),
        ).toBeTruthy();

        await request.storageState({
            path: authFile,
        });
    },
);