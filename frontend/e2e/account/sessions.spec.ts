import {
    expect,
    test,
} from '@playwright/test';

test(
    'hiển thị phiên hiện tại và các phiên khác',
    async ({ page }) => {
        await page.goto(
            '/tai-khoan/thiet-bi',
        );

        await expect(
            page.getByRole('heading', {
                name: 'Thiết bị đăng nhập',
            }),
        ).toBeVisible();

        await expect(
            page.getByText(
                'Thiết bị hiện tại',
            ),
        ).toBeVisible();

        await expect(
            page.getByText(
                'Các phiên đăng nhập khác',
            ),
        ).toBeVisible();
    },
);