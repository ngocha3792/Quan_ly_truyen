import {
    expect,
    test,
} from '@playwright/test';

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
            'e2e.user@truyenhub.test',

            'E2eUser@2026',
        );

        await expect(
            page,
        ).toHaveURL(
            /\/thu-vien$/,
        );

        await expect(
            page.getByText(
                'Thư viện của tôi',
                {
                    exact:
                        true,
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