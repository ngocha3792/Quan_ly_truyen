import {
    expect,
    test,
} from '@playwright/test';

import {
    E2E_USER_EMAIL,
    E2E_USER_PASSWORD,
} from '../fixtures/e2e-user';

import {
    AuthDialogPage,
} from '../pages/auth-dialog.page';

test(
    'anonymous vào thư viện được đưa tới login và quay lại sau login',
    async ({
        page,
    }) => {
        await page.goto(
            '/thu-vien',
        );

        await expect(
            page,
        ).toHaveURL(
            /\/dang-nhap\?returnUrl=%2Fthu-vien/,
        );

        const authDialog =
            new AuthDialogPage(
                page,
            );

        await expect(
            authDialog.dialog,
        ).toBeVisible();

        await authDialog.login(
            E2E_USER_EMAIL,
            E2E_USER_PASSWORD,
        );

        await expect(
            page,
        ).toHaveURL(
            /\/thu-vien$/,
        );

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Thư viện của tôi',

                    level:
                        1,
                },
            ),
        ).toBeVisible();
    },
);

test(
    'anonymous vào author studio được đưa tới login',
    async ({
        page,
    }) => {
        await page.goto(
            '/author-studio',
        );

        await expect(
            page,
        ).toHaveURL(
            /\/dang-nhap\?returnUrl=%2Fauthor-studio/,
        );

        await expect(
            page.getByRole(
                'dialog',
            ),
        ).toBeVisible();
    },
);