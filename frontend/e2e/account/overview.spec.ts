import {
    expect,
    test,
} from '@playwright/test';

test(
    '@smoke mở trang tổng quan tài khoản',
    async ({ page }) => {
        await page.goto('/tai-khoan');

        await expect(
            page.getByRole('heading', {
                name: 'Tổng quan tài khoản',
            }),
        ).toBeVisible();

        await expect(
            page.getByText(
                'Email đã xác minh',
            ),
        ).toBeVisible();
    },
);