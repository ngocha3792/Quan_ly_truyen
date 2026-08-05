import {
    expect,
    test,
} from '@playwright/test';

test(
    'lọc lịch sử theo hoạt động đăng nhập',
    async ({ page }) => {
        await page.goto(
            '/tai-khoan/hoat-dong',
        );

        await page
            .getByRole('tab', {
                name: 'Đăng nhập',
            })
            .click();

        await expect(
            page.getByText(
                'Đăng nhập thành công',
            ),
        ).toBeVisible();

        await expect(
            page.getByText(
                'Đổi mật khẩu',
            ),
        ).toBeHidden();
    },
);