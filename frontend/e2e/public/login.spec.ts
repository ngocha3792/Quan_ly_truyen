import {
    expect,
    test,
} from '@playwright/test';

import {
    AuthDialogPage,
} from '../pages/auth-dialog.page';

test(
    '@smoke người dùng đăng nhập thành công',
    async ({
        page,
    }) => {
        const authDialog =
            new AuthDialogPage(
                page,
            );

        await page.goto('/');

        await authDialog.open();

        await authDialog.login(
            'e2e.user@truyenhub.test',

            'E2eUser@2026',
        );

        await expect(
            page
                .locator(
                    'header',
                )
                .getByRole(
                    'button',

                    {
                        name:
                            /E2E User/,
                    },
                ),
        ).toBeVisible();
    },
);

test(
    'hiển thị lỗi khi mật khẩu sai',
    async ({
        page,
    }) => {
        const authDialog =
            new AuthDialogPage(
                page,
            );

        await page.goto('/');

        await authDialog.open();

        await authDialog.login(
            'e2e.user@truyenhub.test',

            'SaiMatKhau@2026',
        );

        await expect(
            authDialog.error,
        ).toBeVisible();
    },
);