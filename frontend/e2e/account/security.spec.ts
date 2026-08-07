import {
    expect,
    test,
} from '../fixtures/authenticated-test';

test(
    'hiển thị các thiết lập bảo mật',
    async ({
        page,
    }) => {
        await page.goto(
            '/tai-khoan/bao-mat',
        );

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Bảo mật tài khoản',
                },
            ),
        ).toBeVisible();

        await expect(
            page.getByText(
                'Đổi mật khẩu',
            ),
        ).toBeVisible();

        await expect(
            page.getByText(
                'Xác thực 2 lớp',
            ),
        ).toBeVisible();

        await expect(
            page.getByText(
                'Email khôi phục',
            ),
        ).toBeVisible();
    },
);